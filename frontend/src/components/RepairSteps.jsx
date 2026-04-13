export default function RepairSteps({ steps }) {
  if (!steps?.length) return null

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Repair steps</h2>
      <ol className="space-y-6">
        {steps.map((step) => (
          <li key={step.step_number} className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
              {step.step_number}
            </div>
            <div className="flex-1 pt-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-900">{step.title}</h3>
                {step.duration_minutes && (
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{step.duration_minutes} min</span>
                )}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
