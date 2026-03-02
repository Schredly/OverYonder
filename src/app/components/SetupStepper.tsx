import { Check } from 'lucide-react';

interface Step {
  id: number;
  title: string;
}

interface SetupStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function SetupStepper({ steps, currentStep, onStepClick }: SetupStepperProps) {
  return (
    <div className="flex flex-col gap-1">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = index <= currentStep;

        return (
          <button
            key={step.id}
            onClick={() => isClickable && onStepClick(index)}
            disabled={!isClickable}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-md text-left transition-colors
              ${isCurrent ? 'bg-blue-50 text-blue-900' : ''}
              ${isCompleted ? 'text-foreground hover:bg-gray-50' : ''}
              ${!isCompleted && !isCurrent ? 'text-muted-foreground' : ''}
              ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}
            `}
          >
            <div
              className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0
                ${
                  isCompleted
                    ? 'bg-blue-600 text-white'
                    : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                }
              `}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : step.id}
            </div>
            <span className="text-sm">{step.title}</span>
          </button>
        );
      })}
    </div>
  );
}
