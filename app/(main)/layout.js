import Sidebar from '../../components/Sidebar'

export default function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen relative w-full overflow-x-hidden">
      {/* Background Gradient/Glow Effect */}
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
         <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-accent/10 rounded-full blur-[150px] opacity-60 mix-blend-screen animate-pulse-slow" />
         <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-accent-dark/20 rounded-full blur-[120px] opacity-40" />
         <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <Sidebar />
      <main className="flex-1 ml-72 min-h-screen p-8 relative z-0 w-0">
           <div className="max-w-full">
            {children}
           </div>
      </main>
    </div>
  )
}
