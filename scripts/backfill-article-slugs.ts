import { createClient } from '@supabase/supabase-js'

import { generateSlug } from '../server/utils/slugify'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function main() {
  const { data } = await supabase.from('articles').select('id,title,slug').is('slug', null).limit(5000)
  if (!data?.length) {
    console.log('nothing to backfill')
    return
  }

  const used = new Set<string>()

  // Load existing slugs to avoid collisions
  const { data: existing } = await supabase.from('articles').select('slug').not('slug', 'is', null)
  for (const row of (existing ?? []) as Array<{ slug: string | null }>) {
    if (row.slug) used.add(row.slug)
  }

  let done = 0
  for (const a of data as Array<{ id: string; title: string }>) {
    const base = generateSlug(a.title)
    let attempt = base
    let i = 2
    while (used.has(attempt)) {
      attempt = `${base}-${i++}`
    }
    used.add(attempt)

    await supabase.from('articles').update({ slug: attempt }).eq('id', a.id)

    done++
    if (done % 50 === 0) console.log(`  ${done}...`)
  }

  console.log(`Done. ${done} articles slugged.`)
}

main().catch(console.error)
