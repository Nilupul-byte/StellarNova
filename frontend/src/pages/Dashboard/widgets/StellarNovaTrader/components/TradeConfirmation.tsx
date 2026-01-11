/**
 * Trade Confirmation Modal
 * Shows parsed trade details before execution
 */

import { ParsedPrompt } from 'lib/ai/schema';

interface TradeConfirmationProps {
  parsed: ParsedPrompt | null;
  onConfirm: () => void;
  onCancel: () => void;
  estimatedOutput?: string;
  slippage?: number;
  loading?: boolean;
}

export const TradeConfirmation = ({
  parsed,
  onConfirm,
  onCancel,
  estimatedOutput,
  slippage = 5,
  loading = false
}: TradeConfirmationProps) => {
  if (!parsed) return null;

  const { command, confidence, originalPrompt } = parsed;
  const { fromToken, toToken, amount } = command;

  // Simplify token display (remove identifier suffix)
  const fromSymbol = fromToken?.split('-')[0] || fromToken;
  const toSymbol = toToken?.split('-')[0] || toToken;

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'>
      <div className='bg-secondary border border-gray-700 rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto'>
        {/* Header */}
        <div className='mb-6'>
          <h2 className='text-2xl font-bold text-primary mb-2'>
            Confirm Trade
          </h2>
          <p className='text-sm text-gray-400'>
            Review the details before signing
          </p>
        </div>

        {/* Original Prompt */}
        <div className='bg-secondary/50 border border-gray-700 rounded-lg p-4 mb-4'>
          <p className='text-xs text-gray-400 mb-1'>Your Request:</p>
          <p className='text-white italic'>"{originalPrompt}"</p>
        </div>

        {/* Parsed Details */}
        <div className='space-y-4 mb-6'>
          {/* Action */}
          <div className='flex justify-between items-center'>
            <span className='text-gray-400'>Action:</span>
            <span className='text-white font-semibold capitalize'>
              {command.action === 'market_buy'
                ? 'Buy'
                : command.action === 'market_sell'
                ? 'Sell'
                : 'Swap'}
            </span>
          </div>

          {/* From Token */}
          <div className='flex justify-between items-center'>
            <span className='text-gray-400'>From:</span>
            <span className='text-white font-mono'>
              {amount} {fromSymbol}
            </span>
          </div>

          {/* To Token */}
          <div className='flex justify-between items-center'>
            <span className='text-gray-400'>To:</span>
            <span className='text-white font-mono'>{toSymbol}</span>
          </div>

          {/* Estimated Output */}
          {estimatedOutput && (
            <div className='flex justify-between items-center'>
              <span className='text-gray-400'>Estimated Output:</span>
              <span className='text-accent font-mono'>
                {estimatedOutput} {toSymbol}
              </span>
            </div>
          )}

          {/* Slippage */}
          <div className='flex justify-between items-center'>
            <span className='text-gray-400'>Max Slippage:</span>
            <span className='text-white'>{slippage}%</span>
          </div>

          {/* Confidence */}
          <div className='flex justify-between items-center'>
            <span className='text-gray-400'>AI Confidence:</span>
            <div className='flex items-center gap-2'>
              <div className='w-32 h-2 bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className={`h-full ${
                    confidence >= 0.8
                      ? 'bg-green-500'
                      : confidence >= 0.6
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className='text-white text-sm'>
                {(confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className='bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6'>
          <p className='text-yellow-500 text-sm'>
            ⚠️ <strong>Review Carefully:</strong> This trade will execute
            on-chain immediately after you sign. Ensure all details are correct.
          </p>
        </div>

        {/* Actions */}
        <div className='flex gap-3'>
          <button
            onClick={onCancel}
            disabled={loading}
            className='flex-1 px-6 py-3 bg-secondary border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className='flex-1 px-6 py-3 bg-gradient-to-r from-primary to-accent text-secondary font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50'
          >
            {loading ? 'Signing...' : 'Confirm & Sign'}
          </button>
        </div>

        {/* Info */}
        <p className='text-xs text-gray-500 text-center mt-4'>
          Your wallet will prompt you to sign this transaction
        </p>
      </div>
    </div>
  );
};
