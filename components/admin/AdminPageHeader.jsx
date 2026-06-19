import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const AdminPageHeader = ({
  icon: Icon,
  title,
  subtitle,
  children,
  backTo = '/admin',
  showBack = true,
}) => {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-charcoal text-white p-6 sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-red/40 via-brand-charcoal to-brand-charcoal pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-brand-red/10 blur-2xl pointer-events-none" />
      <div className="relative">
        {showBack && (
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center gap-1 text-xs font-medium text-white/50 hover:text-white/80 transition-colors mb-4 group"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
        )}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              {Icon && (
                <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center shadow-lg shadow-brand-red/30">
                  <Icon className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="text-xs font-bold uppercase tracking-widest text-white/50">Admin Panel</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-1">{title}</h1>
            {subtitle && <p className="text-white/60 text-sm">{subtitle}</p>}
          </div>
          {children && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPageHeader;
