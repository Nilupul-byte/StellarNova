/**
 * AI Prompt Input Component
 * Allows users to enter natural language trading commands
 */

import { ChangeEvent } from 'react';

interface PromptInputProps {
  prompt: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  loading: boolean;
  disabled?: boolean;
}

const EXAMPLE_PROMPTS = [
  'Swap 10 USDC to WEGLD',
  'Buy 0.5 WEGLD with USDC',
  'Convert all my USDC to WEGLD',
  'Sell 1 WEGLD for USDC'
];

export const PromptInput = ({
  prompt,
  onChange,
  onExecute,
  loading,
  disabled = false
}: PromptInputProps) => {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className='flex flex-col gap-4'>
      {/* Input Section */}
      <div className='flex flex-col gap-2'>
        <label className='text-sm text-gray-400'>
          Enter your trade instruction:
        </label>
        <textarea
          value={prompt}
          onChange={handleChange}
          placeholder='Example: Swap 10 USDC to WEGLD'
          className='w-full bg-secondary border border-gray-700 rounded-lg px-4 py-3 text-white min-h-[120px] resize-none focus:outline-none focus:border-primary transition'
          disabled={disabled}
        />

        <button
          onClick={onExecute}
          disabled={loading || !prompt.trim() || disabled}
          className='w-full px-6 py-3 bg-gradient-to-r from-primary to-accent text-secondary font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {loading ? 'Processing...' : 'Execute Trade'}
        </button>
      </div>

      {/* How It Works */}
      <div className='bg-accent/10 border border-accent/30 rounded-lg p-4'>
        <h3 className='font-semibold text-accent mb-2'>How it works:</h3>
        <ol className='text-sm text-gray-300 space-y-1 list-decimal list-inside'>
          <li>Type what you want to trade in plain English</li>
          <li>AI parses your intent into a structured trade</li>
          <li>Review the trade details</li>
          <li>Sign with your wallet - trade executes directly on xExchange!</li>
        </ol>
        <p className='text-xs text-accent/80 mt-2'>
          ⚡ Your funds never leave your wallet until you sign!
        </p>
      </div>

      {/* Example Prompts */}
      <div className='bg-secondary/50 border border-gray-700 rounded-lg p-4'>
        <h3 className='font-semibold text-accent mb-3'>Example Prompts:</h3>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
          {EXAMPLE_PROMPTS.map((example, i) => (
            <button
              key={i}
              onClick={() => onChange(example)}
              disabled={disabled}
              className='text-left px-4 py-2 bg-secondary/50 hover:bg-secondary border border-gray-700 rounded-lg text-sm text-gray-300 transition disabled:opacity-50'
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
