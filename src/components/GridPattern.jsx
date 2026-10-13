import { useId } from 'react'

export default function GridPattern({
  width = 64,
  height = 64,
  x = -1,
  y = -1,
  squares = [],
  strokeDasharray = 0,
  className = '',
}) {
  const patternId = useId().replaceAll(':', '')

  return (
    <svg
      aria-hidden="true"
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            stroke="currentColor"
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      {squares.length > 0 && (
        <svg x={x} y={y} className="app-grid-squares overflow-visible">
          {squares.map(([squareX, squareY], index) => (
            <rect
              key={`${squareX}-${squareY}-${index}`}
              width={width - 1}
              height={height - 1}
              x={squareX * width + 1}
              y={squareY * height + 1}
              strokeWidth="0"
            />
          ))}
        </svg>
      )}
    </svg>
  )
}
