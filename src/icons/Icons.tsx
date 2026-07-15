import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconSelect(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 3.2 19 9.6l-6.3 1.9-1.9 6.3z" />
    </svg>
  )
}

export function IconText(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5h14M12 5v14M9 19h6" />
    </svg>
  )
}

export function IconShape(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="11" height="11" rx="1.6" />
      <circle cx="15.5" cy="15.5" r="5" />
    </svg>
  )
}

export function IconImage(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="m4.5 18 4.8-4.8 3 2.8 4.2-4.2 3 3" />
    </svg>
  )
}

export function IconGrid(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9h16M4 15h16M9 4v16M15 4v16" />
    </svg>
  )
}

export function IconFit(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5" />
    </svg>
  )
}

export function IconExport(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v11M8.5 6.5 12 3l3.5 3.5M5 13.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5" />
    </svg>
  )
}

export function IconMockup(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 3.5 5 6.5v3.2l2-1V19a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8.7l2 1V6.5L15.5 3.5a3.5 3.5 0 0 1-7 0Z" />
    </svg>
  )
}

export function IconSave(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4.5h11.5L19 7v12.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <path d="M8 4.5v5h7v-5M8 20v-6h8v6" />
    </svg>
  )
}

export function IconHistory(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M3 4.5v4h4M12 8v4.5l3 2" />
    </svg>
  )
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

/* ---- INC-2: layers, transform & arrange icons ---------------------------- */

export function IconEye(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}

export function IconEyeOff(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4l16 16M9.9 6.1A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.2 3.9M6 8.3A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.5-.7" />
    </svg>
  )
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5.5" y="10.5" width="13" height="9" rx="1.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  )
}

export function IconLockOpen(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5.5" y="10.5" width="13" height="9" rx="1.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2" />
    </svg>
  )
}

export function IconUp(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19V5m0 0-5.5 5.5M12 5l5.5 5.5" />
    </svg>
  )
}

export function IconDown(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14m0 0-5.5-5.5M12 19l5.5-5.5" />
    </svg>
  )
}

export function IconGroup(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="11" height="11" rx="1" />
      <rect x="9" y="9" width="11" height="11" rx="1" />
    </svg>
  )
}

export function IconUngroup(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="8" height="8" rx="1" />
      <rect x="12" y="12" width="8" height="8" rx="1" />
      <path d="M12 8h2M8 12v2" strokeDasharray="1.5 2.5" />
    </svg>
  )
}

export function IconDuplicate(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 4.5H6A1.5 1.5 0 0 0 4.5 6v10" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 6.5h15M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7M6.5 6.5l.8 12.2a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.2" />
    </svg>
  )
}

export function IconFlipH(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v18M8.5 7.5 4 12l4.5 4.5M15.5 7.5 20 12l-4.5 4.5" strokeDasharray="0" />
    </svg>
  )
}

export function IconFlipV(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h18M7.5 8.5 12 4l4.5 4.5M7.5 15.5 12 20l4.5 4.5" />
    </svg>
  )
}

export function IconLinked(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 14a4 4 0 0 0 6 .4l2.5-2.5a4 4 0 1 0-5.7-5.7L11.6 7.4" />
      <path d="M14 10a4 4 0 0 0-6-.4L5.5 12.1a4 4 0 1 0 5.7 5.7l1.2-1.2" />
    </svg>
  )
}

export function IconUnlinked(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 9.5 20 4M9.5 14.5 4 20M13 6.5l1-1a4 4 0 1 1 4.5 4.5l-1 1M11 17.5l-1 1A4 4 0 1 1 5.5 14l1-1" />
    </svg>
  )
}

export function IconAlignLeft(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 3v18" />
      <rect x="7.5" y="6" width="10" height="4.5" rx="0.8" />
      <rect x="7.5" y="13.5" width="6" height="4.5" rx="0.8" />
    </svg>
  )
}

export function IconAlignCenterH(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v3.2m0 4.6v2.4m0 4.6V21" />
      <rect x="6" y="6.2" width="12" height="4.4" rx="0.8" />
      <rect x="8" y="13.2" width="8" height="4.4" rx="0.8" />
    </svg>
  )
}

export function IconAlignRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19.5 3v18" />
      <rect x="6.5" y="6" width="10" height="4.5" rx="0.8" />
      <rect x="10.5" y="13.5" width="6" height="4.5" rx="0.8" />
    </svg>
  )
}

export function IconAlignTop(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 4.5h18" />
      <rect x="6" y="7.5" width="4.5" height="10" rx="0.8" />
      <rect x="13.5" y="7.5" width="4.5" height="6" rx="0.8" />
    </svg>
  )
}

export function IconAlignMiddle(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h3.2m4.6 0h2.4m4.6 0H21" />
      <rect x="6.2" y="6" width="4.4" height="12" rx="0.8" />
      <rect x="13.2" y="8" width="4.4" height="8" rx="0.8" />
    </svg>
  )
}

export function IconAlignBottom(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 19.5h18" />
      <rect x="6" y="6.5" width="4.5" height="10" rx="0.8" />
      <rect x="13.5" y="10.5" width="4.5" height="6" rx="0.8" />
    </svg>
  )
}

export function IconDistributeH(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 3v18M20 3v18" />
      <rect x="9.75" y="7" width="4.5" height="10" rx="0.8" />
    </svg>
  )
}

export function IconDistributeV(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 4h18M3 20h18" />
      <rect x="7" y="9.75" width="10" height="4.5" rx="0.8" />
    </svg>
  )
}
