import { chatSystemPrompt } from '../prompts/chat.prompt.js';
import { chatMockReply } from '../mocks/index.js';
import { env } from '../config/env.js';
import { streamChat } from './ai.service.js';
import { buildStudentContext } from './student.service.js';
import { safeTcasContext } from './recommend.service.js';
import { getProgram, getCutoffs } from './tcas.service.js';
import { matchCutoffs } from './scoring.js';
import { dbError } from '../utils/AppError.js';

const HISTORY_SIZE = 10;

// everything that can fail before streaming starts, so we can still answer with a normal JSON error
// turn the frontend's page context into a few facts for the prompt.
// program_id is looked up so the coach sees real weights + last year's cutoff, not what the client claims
async function coachContext(context) {
  if (!context) return null;
  const out = { ...context, program_id: undefined };
  if (context.program_id) {
    try {
      const program = await getProgram(context.program_id);
      const cutoffs = await getCutoffs(program).catch(() => []);
      const round3 = program.admissions.filter((a) => a.round === 3 && a.score_weights);
      out.active_program = {
        university: program.university,
        faculty: program.faculty,
        program: program.program,
        round3_projects: round3.slice(0, 3).map((a) => ({
          project_name: a.project_name,
          score_weights: a.score_weights,
          last_years_min: matchCutoffs(a, cutoffs).map((h) => ({ year: h.academic_year, min: h.min_score })),
        })),
      };
    } catch {
      // unknown id - just leave it out
    }
  }
  return out;
}

// what is saved for a message with files: the text + the file names (the files themselves are not kept)
const withFileNames = (message, attachments = []) =>
  attachments.length ? `${message}\n\n📎 ${attachments.map((f) => f.name).join(', ')}` : message;

export async function prepareChat(db, userId, message, context, attachments = []) {
  const [student, historyRes] = await Promise.all([
    buildStudentContext(db, userId),
    db
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_SIZE),
  ]);
  if (historyRes.error) throw dbError(historyRes.error, 'load chat history');

  // the student's target programs + calendar. anything else, the model can google (it decides when)
  const [tcas, page] = await Promise.all([safeTcasContext(student.target_faculties), coachContext(context)]);
  const webSearch = env.TCAS_WEB_SEARCH;

  const { error } = await db.from('chat_messages').insert({ user_id: userId, role: 'user', content: withFileNames(message, attachments) });
  if (error) throw dbError(error, 'save user message');

  return {
    systemPrompt: chatSystemPrompt({ student, tcas, webSearch, page }),
    history: historyRes.data.reverse(),
    webSearch,
  };
}

export function chatStream({ systemPrompt, history, message, attachments = [], signal, webSearch, onSources, lang }) {
  const mockReply = attachments.length ? `(ตัวอย่าง) ได้รับไฟล์แนบ: ${attachments.map((f) => f.name).join(', ')} • ${chatMockReply}` : chatMockReply;
  return streamChat({ systemPrompt, history, message, attachments, signal, mockReply, useSearch: webSearch, onSources, lang });
}

export async function saveAssistantMessage(db, userId, content) {
  const { data, error } = await db
    .from('chat_messages')
    .insert({ user_id: userId, role: 'assistant', content })
    .select('id, created_at')
    .single();
  if (error) throw dbError(error, 'save assistant message');
  return data;
}
