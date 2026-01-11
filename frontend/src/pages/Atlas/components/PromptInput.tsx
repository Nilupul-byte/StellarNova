interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export const PromptInput = ({
  value,
  onChange,
  onAnalyze,
  isAnalyzing
}: PromptInputProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAnalyze();
    }
  };

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <label
          htmlFor='atlas-prompt'
          className='text-sm font-medium text-primary'
        >
          Describe your trade
        </label>
        <textarea
          id='atlas-prompt'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isAnalyzing}
          placeholder='e.g., "Buy 0.5 WEGLD with USDC" or "Swap 100 USDC to WEGLD"'
          className='w-full min-h-[100px] p-4 rounded-lg border border-secondary bg-primary text-primary placeholder-gray-500 focus:outline-none focus:border-link transition-colors resize-none'
        />
      </div>

      <button
        type='submit'
        disabled={!value.trim() || isAnalyzing}
        className='w-full py-3 px-6 rounded-lg bg-link text-white font-medium hover:bg-opacity-90 disabled:bg-secondary disabled:cursor-not-allowed transition-all'
      >
        {isAnalyzing ? (
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
            Analyzing Market...
          </span>
        ) : (
          '🧭 Analyze with Atlas AI'
        )}
      </button>
    </form>
  );
};
