'use client'

import { useState } from 'react'
import { ChevronDown, Copy, FileText } from 'lucide-react'
import type { SessionTemplate } from '@/types'

interface TemplatePickerProps {
  templates: SessionTemplate[]
  onLoadTemplate: (template: SessionTemplate, cloneExact: boolean) => void
}

export function TemplatePicker({ templates, onLoadTemplate }: TemplatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate | null>(null)

  if (templates.length === 0) return null

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
      >
        <FileText className="w-4 h-4" />
        Load from template
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          {selectedTemplate ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <strong>{selectedTemplate.name}</strong>
                {selectedTemplate.description && (
                  <span className="text-gray-500"> - {selectedTemplate.description}</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {selectedTemplate.template_data.slots.length} tasks,{' '}
                {Math.round(
                  selectedTemplate.template_data.slots.reduce(
                    (sum, s) => sum + s.allocated_time_ms,
                    0
                  ) / 60000
                )}{' '}
                min total
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onLoadTemplate(selectedTemplate, true)
                    setIsOpen(false)
                    setSelectedTemplate(null)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Copy className="w-3 h-3" />
                  Clone exact tasks
                </button>
                <button
                  onClick={() => {
                    onLoadTemplate(selectedTemplate, false)
                    setIsOpen(false)
                    setSelectedTemplate(null)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clone structure only
                </button>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-white transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {template.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {template.template_data.slots.length} tasks
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
