import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'micro', 'caption', 'footnote', 'subhead', 'body', 'title1', 'title2',
            'large-title', 'title-1', 'metric', 'title-3', 'headline', 'eyebrow', 'tab',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
