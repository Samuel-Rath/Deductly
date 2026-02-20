import * as LucideIcons from 'lucide-react'

export type IconName = keyof typeof LucideIcons

interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

export function Icon({ name, size = 20, className = '', strokeWidth = 2 }: IconProps) {
  const IconComponent = LucideIcons[name] as React.ComponentType<LucideIcons.LucideProps>
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`)
    return null
  }

  return <IconComponent size={size} className={className} strokeWidth={strokeWidth} />
}
