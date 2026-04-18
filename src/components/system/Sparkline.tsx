import { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  strokeColor?: string
  fillColor?: string
  className?: string
}

export default function Sparkline({
  data,
  width = 100,
  height = 28,
  strokeColor = '#0d9488',
  fillColor = 'rgba(13, 148, 136, 0.15)',
  className,
}: SparklineProps) {
  const { linePath, areaPath, lastX, lastY } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: '', areaPath: '', lastX: 0, lastY: 0 }
    }
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const stepX = data.length > 1 ? width / (data.length - 1) : 0
    const padY = 2

    const points = data.map((v, i) => {
      const x = i * stepX
      const y = padY + (height - padY * 2) * (1 - (v - min) / range)
      return [x, y] as const
    })

    const linePath = points
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(' ')

    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`
    const [lx, ly] = points[points.length - 1]
    return { linePath, areaPath, lastX: lx, lastY: ly }
  }, [data, width, height])

  if (data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden="true"
      />
    )
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <path d={areaPath} fill={fillColor} />
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={strokeColor} />
    </svg>
  )
}
