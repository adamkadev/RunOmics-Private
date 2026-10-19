import { cardClass } from '@/components/ui/Card'

/**
 * The grouped card every Settings section draws its rows in (3.0 1i): radius
 * 18, the rows' own padding, a hairline between them.
 */
export const GROUP_CARD = cardClass({ padding: 'none', overflow: true, className: 'rounded-[18px]' })

/** One row of a group: at least 46 pt tall, its label left and its value or control right. */
export const GROUP_ROW = 'flex min-h-[46px] w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0'
