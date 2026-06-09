import React from 'react';
import { ShieldCheck, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const BuyerProtection = ({ compact = false, className = '' }) => {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <ShieldCheck className="w-4 h-4 text-green-600" />
        <span className="font-medium text-foreground">Buyer Protection</span>
        <Badge variant="outline" className="text-xs">14-Day Guarantee</Badge>
      </div>
    );
  }

  return (
    <div className={`bg-green-50 border border-green-200 rounded-xl p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-green-900">Buyer Protection Guarantee</h3>
          <p className="text-sm text-green-700">Shop with confidence on CardPop</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-green-900 text-sm">14-Day Protection</h4>
            <p className="text-xs text-green-700">Full refund if item not as described</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-green-900 text-sm">Easy Returns</h4>
            <p className="text-xs text-green-700">Simple return process with support</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-green-900 text-sm">Verified Sellers</h4>
            <p className="text-xs text-green-700">Only trusted sellers on our platform</p>
          </div>
        </div>
      </div>

      <div className="text-xs text-green-700 space-y-1">
        <p>• Full refund if item doesn't arrive or isn't as described</p>
        <p>• Free return shipping for defective items</p>
        <p>• Dispute resolution support from CardPop team</p>
      </div>
    </div>
  );
};

export default BuyerProtection;
