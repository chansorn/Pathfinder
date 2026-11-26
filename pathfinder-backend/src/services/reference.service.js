import { anonClient } from '../config/supabase.js';
import { badRequest, dbError } from '../utils/AppError.js';

// % and _ are wildcards in LIKE, escape them so "ม_1" means a literal underscore
const escapeLike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function listSchools({ q, province, limit }) {
  let query = anonClient().from('schools').select('id, name, province');
  if (q) query = query.ilike('name', `%${escapeLike(q)}%`);
  if (province) query = query.eq('province', province);

  const { data, error } = await query.order('name').limit(limit);
  if (error) throw dbError(error, 'list schools');
  return data;
}

export async function listGradeLevels() {
  const { data, error } = await anonClient().from('grade_levels').select('id, code, name').order('id');
  if (error) throw dbError(error, 'list grade levels');
  return data;
}

// make sure the ids exist, otherwise we'd hit an FK error on signup / profile update
export async function assertReferencesExist(client, { school_id, grade_level_id }) {
  const checks = [
    ['schools', school_id, 'ไม่พบโรงเรียนที่เลือก'],
    ['grade_levels', grade_level_id, 'ไม่พบระดับชั้นที่เลือก'],
  ];
  for (const [table, value, message] of checks) {
    if (value == null) continue;
    const { data, error } = await client.from(table).select('id').eq('id', value).maybeSingle();
    if (error) throw dbError(error, `check ${table}`);
    if (!data) throw badRequest(message);
  }
}
