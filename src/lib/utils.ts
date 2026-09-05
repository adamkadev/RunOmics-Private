import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The font sizes in globals.css (--text-micro …) are ours, so tailwind-merge
// cannot know them: it reads `text-micro` as a text *color* and silently drops
// it whenever a real color follows in the same cn() call. Declaring them keeps
// `cn('text-micro …', 'text-muted-foreground')` rendering at 10px.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['micro', 'caption', 'footnote', 'subhead', 'body', 'title1', 'title2'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
