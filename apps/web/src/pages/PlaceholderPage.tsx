export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-800 mb-2">{title}</h1>
      <p className="text-stone-400 text-sm">— à venir</p>
    </div>
  )
}
