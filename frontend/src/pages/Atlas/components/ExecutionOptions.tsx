import { useState } from 'react';

interface ExecutionOption {
  id: number;
  action: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
}

interface ExecutionOptionsProps {
  options: ExecutionOption[];
  onExecute: (optionId: number) => void;
  onReset: () => void;
  isExecuting?: boolean;
}

export const ExecutionOptions = ({
  options,
  onExecute,
  onReset,
  isExecuting = false
}: ExecutionOptionsProps) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-500 bg-green-500 bg-opacity-10 border-green-500';
      case 'medium':
        return 'text-yellow-500 bg-yellow-500 bg-opacity-10 border-yellow-500';
      default:
        return 'text-red-500 bg-red-500 bg-opacity-10 border-red-500';
    }
  };

  const handleExecute = () => {
    if (selectedOption === null) return;
    onExecute(selectedOption);
  };

  return (
    <div className='flex flex-col gap-6'>
      <div className='border-t border-secondary pt-6'>
        <h3 className='text-xl font-semibold text-primary mb-4'>
          ⚡ Execution Options
        </h3>

        <div className='grid grid-cols-1 gap-4'>
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                selectedOption === option.id
                  ? 'border-link bg-link bg-opacity-10'
                  : 'border-secondary hover:border-link hover:border-opacity-50'
              }`}
            >
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-2'>
                    <span className='font-semibold text-primary'>
                      Option {option.id}: {option.action}
                    </span>
                  </div>
                  <p className='text-sm text-secondary'>{option.description}</p>
                </div>

                {selectedOption === option.id && (
                  <div className='flex-shrink-0'>
                    <svg
                      className='w-6 h-6 text-link'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className='flex gap-4'>
        <button
          onClick={handleExecute}
          disabled={selectedOption === null || isExecuting}
          className='flex-1 py-3 px-6 rounded-lg bg-link text-white font-medium hover:bg-opacity-90 disabled:bg-secondary disabled:cursor-not-allowed transition-all'
        >
          {isExecuting ? (
            <span className='flex items-center justify-center gap-2'>
              <svg className='animate-spin h-5 w-5' viewBox='0 0 24 24'>
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                  fill='none'
                />
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                />
              </svg>
              Executing...
            </span>
          ) : (
            `Execute Option ${selectedOption || '-'}`
          )}
        </button>

        <button
          onClick={onReset}
          disabled={isExecuting}
          className='px-6 py-3 rounded-lg border border-secondary text-primary hover:border-link transition-all'
        >
          New Analysis
        </button>
      </div>
    </div>
  );
};
