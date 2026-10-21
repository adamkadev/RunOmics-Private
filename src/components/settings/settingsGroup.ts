import { cardClass } from '@/components/ui/Card'

/**
 * The inset-grouped card every Settings section draws its rows in (Liquid
 * Glass v3, G9): the 24 pt card, the rows' own padding, a 0.5 pt separator
 * between them inset 16 pt, none above the first (globals.css .inset-group).
 */
export const GROUP_CARD = cardClass({ padding: 'none', overflow: true, className: 'inset-group [--row-inset:16px]' })

/** One row of a group: at least 46 pt tall, its label left and its value or control right. */
export const GROUP_ROW = 'flex min-h-[46px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[17px] tracking-[-0.027rem]'
