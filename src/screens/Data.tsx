import { BackupCard } from './data/BackupCard'
import { ExportCard } from './data/ExportCard'
import { RestoreCard } from './data/RestoreCard'
import { StorageCard } from './data/StorageCard'
import { SummaryCard } from './data/SummaryCard'
import { useNav } from '../nav'

export function Data() {
  const { nav, openOverlay } = useNav()
  return (
    <section aria-labelledby="data-h">
      <div className="screen-head">
        <h1 id="data-h">Data</h1>
        <button type="button" className="btn" onClick={() => openOverlay({ kind: 'settings' })}>Settings and help</button>
      </div>
      <StorageCard />
      <BackupCard focusOnOpen={nav.dataFocus === 'backup'} />
      <ExportCard />
      <SummaryCard />
      <RestoreCard />
    </section>
  )
}
