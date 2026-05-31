import fs from 'fs'
import path from 'path'

interface Post {
  slug: string
  title: string
  date: string
  description: string
  category: string
  author: string
  image?: string
  content: string
}

export default defineEventHandler((event) => {
  const contentDir = path.resolve(process.cwd(), 'content/blog')
  
  // Se a pasta ainda não existir, retorna uma lista vazia
  if (!fs.existsSync(contentDir)) {
    return []
  }

  const files = fs.readdirSync(contentDir)
  const posts: Post[] = []

  files.forEach((file) => {
    if (file.endsWith('.md')) {
      const filePath = path.join(contentDir, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      
      // Simples parser de Front-Matter sem dependências pesadas
      const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
      
      if (match) {
        const frontmatterRaw = match[1]
        const content = match[2].trim()
        
        const metadata: Record<string, string> = {}
        frontmatterRaw.split('\n').forEach((line) => {
          const parts = line.split(':')
          if (parts.length >= 2) {
            const key = parts[0].trim()
            // Junta os valores caso haja múltiplos dois-pontos (ex: URLs ou datas ISO)
            const value = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '')
            metadata[key] = value
          }
        })
        
        const slug = file.replace(/\.md$/, '')
        
        posts.push({
          slug,
          title: metadata.title || 'Sem título',
          date: metadata.date || new Date().toISOString(),
          description: metadata.description || '',
          category: metadata.category || 'Outros',
          author: metadata.author || 'Vale PCD',
          image: metadata.image || undefined,
          content: content
        })
      }
    }
  })

  // Ordena os posts: Mais recentes primeiro
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})
