function encodeQuery(name) {
  return encodeURIComponent(name)
}

function generateLinks(name) {
  const q = encodeQuery(name)
  return {
    Bunnings: `https://www.bunnings.com.au/search/results?q=${q}`,
    'Amazon AU': `https://www.amazon.com.au/s?k=${q}`,
    'Mitre 10': `https://www.mitre10.com.au/search?q=${q}`,
  }
}

const RETAILER_COLOURS = {
  Bunnings: 'bg-green-600 hover:bg-green-700',
  'Amazon AU': 'bg-orange-500 hover:bg-orange-600',
  'Mitre 10': 'bg-red-600 hover:bg-red-700',
}

export default function RetailerLinks({ materials }) {
  if (!materials?.length) return null

  return (
    <div className="space-y-4">
      {materials.map((m, i) => {
        const links = generateLinks(m.name)
        return (
          <div key={i}>
            <p className="text-sm font-medium text-gray-700 mb-2">{m.name}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(links).map(([retailer, url]) => (
                <a
                  key={retailer}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium transition ${RETAILER_COLOURS[retailer]}`}
                >
                  {retailer}
                </a>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
