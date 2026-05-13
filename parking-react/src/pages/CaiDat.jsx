import { PageLayout } from '../components/UI'

export default function CaiDat() {
  return (
    <PageLayout title="⚙️ Cài đặt" backTo="/">
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔧</div>
        <p style={{ color: 'var(--text-muted)' }}>Tính năng đang phát triển.</p>
      </div>
    </PageLayout>
  )
}
