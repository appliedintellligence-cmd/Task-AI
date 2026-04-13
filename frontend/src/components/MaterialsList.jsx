export default function MaterialsList({ materials }) {
  if (!materials?.length) return null

  const total = materials.reduce((sum, m) => sum + (m.estimated_cost_aud || 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="pb-3 font-medium">Material</th>
            <th className="pb-3 font-medium">Qty</th>
            <th className="pb-3 font-medium">Unit</th>
            <th className="pb-3 font-medium text-right">Est. cost (AUD)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {materials.map((m, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="py-3 font-medium text-gray-800">{m.name}</td>
              <td className="py-3 text-gray-600">{m.quantity}</td>
              <td className="py-3 text-gray-600">{m.unit}</td>
              <td className="py-3 text-right text-gray-800">${m.estimated_cost_aud?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200">
            <td colSpan={3} className="pt-3 font-semibold text-gray-900">Total estimate</td>
            <td className="pt-3 text-right font-bold text-blue-600">${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
