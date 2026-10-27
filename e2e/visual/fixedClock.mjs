// Ticks on from the fixed instant rather than stopping there: Next.js times its caches with it.
const fixedNow = Date.parse(process.env.RUNOMICS_FIXED_NOW ?? '')
if (Number.isNaN(fixedNow)) throw new Error('RUNOMICS_FIXED_NOW must be an ISO instant.')

const RealDate = Date
const realNow = RealDate.now.bind(RealDate)
const offset = fixedNow - realNow()

RealDate.now = () => realNow() + offset
// A proxy rather than a subclass, so a date Node itself makes is still `instanceof Date`.
globalThis.Date = new Proxy(RealDate, {
  construct: (target, args, newTarget) => Reflect.construct(target, args.length > 0 ? args : [RealDate.now()], newTarget),
  apply: () => new RealDate(RealDate.now()).toString(),
})
