import { z } from 'zod';
const optNum = z.coerce.number().nullable().optional().catch(null as any);
const reqNum = z.coerce.number().min(0).catch(0);
const schema = z.object({ o: optNum, r: reqNum });
type S = z.infer<typeof schema>;
const x: S = { o: null, r: 0 };
console.log(x);
