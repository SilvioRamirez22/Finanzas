import AppProvider from '@/components/layout/AppProvider'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>
}
