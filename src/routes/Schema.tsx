import { useMemo } from 'react'
import { listTags } from '../vault/api'
import type { TagRecord } from '../vault/types'
import { useAsync } from '../vault/useAsync'
import { Loading, ErrorBanner } from '../components/common'

// The tag schema, made visible — the shape of the vault, so it can be reviewed
// and tended. Renders the tag hierarchy (roots → children) with each tag's
// description, indexed/typed fields, and usage count.
export function Schema() {
  const { data, loading, error, reload } = useAsync(() => listTags(), [])

  const { roots, childrenOf } = useMemo(() => {
    const tags = (data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
    const byName = new Map(tags.map((t) => [t.name, t]))
    const childrenOf = new Map<string, TagRecord[]>()
    const roots: TagRecord[] = []
    for (const t of tags) {
      const parents = (t.parent_names ?? []).filter((p) => byName.has(p))
      if (parents.length === 0) roots.push(t)
      else for (const p of parents) {
        const arr = childrenOf.get(p) ?? []
        arr.push(t)
        childrenOf.set(p, arr)
      }
    }
    return { roots, childrenOf }
  }, [data])

  const total = data?.length ?? 0

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div className="kicker">the shape of the vault</div>
        <h1>Tag Schema</h1>
        <p className="sub">
          {total} tags. The grammar your notes are written in — review it, tend it, keep it coherent.
        </p>
      </div>

      {loading && <Loading label="Reading the schema…" />}
      {Boolean(error) && <ErrorBanner error={error} onRetry={reload} />}

      {data && (
        <div className="schema-tree">
          {roots.map((t) => (
            <TagNode key={t.name} tag={t} childrenOf={childrenOf} depth={0} />
          ))}
        </div>
      )}
    </div>
  )
}

function TagNode({
  tag,
  childrenOf,
  depth,
}: {
  tag: TagRecord
  childrenOf: Map<string, TagRecord[]>
  depth: number
}) {
  const kids = childrenOf.get(tag.name) ?? []
  const fields = tag.fields && typeof tag.fields === 'object' ? Object.entries(tag.fields) : []
  return (
    <div className="schema-node" style={{ marginLeft: depth * 18 }}>
      <div className="schema-row">
        <span className="schema-name">{tag.name}</span>
        {tag.count > 0 && <span className="schema-count">{tag.count}</span>}
      </div>
      {tag.description && <p className="schema-desc">{tag.description}</p>}
      {fields.length > 0 && (
        <div className="schema-fields">
          {fields.map(([key, f]) => (
            <span className="schema-field" key={key}>
              <span className="sf-key">{key}</span>
              <span className="sf-type">{f?.type ?? '?'}</span>
              {Array.isArray(f?.enum) && f.enum.length > 0 && (
                <span className="sf-enum">{f.enum.join(' · ')}</span>
              )}
              {f?.indexed && <span className="sf-indexed">indexed</span>}
            </span>
          ))}
        </div>
      )}
      {kids.length > 0 && (
        <div className="schema-children">
          {kids.map((k) => (
            <TagNode key={k.name} tag={k} childrenOf={childrenOf} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
