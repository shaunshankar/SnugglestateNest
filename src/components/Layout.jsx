import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
