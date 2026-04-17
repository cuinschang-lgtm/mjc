<<<<<<< HEAD
import Sidebar from '../../components/Sidebar'

export default function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen relative">
      {/* Background Gradient/Glow Effect - Refined for "OffBeat" style */}
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
         {/* Top Right Warm Glow */}
         <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-accent/10 rounded-full blur-[150px] opacity-60 mix-blend-screen animate-pulse-slow" />
         
         {/* Bottom Left Deep Glow */}
         <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-accent-dark/20 rounded-full blur-[120px] opacity-40" />
         
         {/* Subtle Grain Overlay (Optional, adds texture) */}
         <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <Sidebar />
      <main className="flex-1 ml-72 min-h-screen p-10 relative z-0">
           <div className="max-w-[1600px] mx-auto">
            {children}
           </div>
      </main>
    </div>
  )
}
=======
import Sidebar from '../../components/Sidebar'
import OnboardingTour from '../../components/OnboardingTour'

export default function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen relative">
      {/* Background Gradient/Glow Effect - Refined for "OffBeat" style */}
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
         {/* Top Right Warm Glow */}
         <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-accent/10 rounded-full blur-[150px] opacity-60 mix-blend-screen animate-pulse-slow" />
         
         {/* Bottom Left Deep Glow */}
         <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-accent-dark/20 rounded-full blur-[120px] opacity-40" />
         
         {/* Subtle Grain Overlay (Optional, adds texture) */}
         <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <Sidebar />
      <OnboardingTour />
      <main className="flex-1 ml-72 min-h-screen p-10 relative z-0">
           <div className="max-w-[1600px] mx-auto">
            {children}
           </div>
      </main>
    </div>
  )
}
>>>>>>> 887dea10 (feat: 拾音/Pickup 准备上线)
