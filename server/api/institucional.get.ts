import fs from 'fs'
import path from 'path'

interface Document {
  slug: string
  title: string
  date: string
  description: string
  file?: string
  content: string
}

export default defineEventHandler((event) => {
  const contentDir = path.resolve(process.cwd(), 'content/institucional')
  
  // If the folder doesn't exist, return empty list
  if (!fs.existsSync(contentDir)) {
    return []
  }

  const files = fs.readdirSync(contentDir)
  const documents: Document[] = []

  files.forEach((file) => {
    if (file.endsWith('.md')) {
      const filePath = path.join(contentDir, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      
      // Simple Front-Matter parser
      const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
      
      if (match) {
        const frontmatterRaw = match[1]
        const content = match[2].trim()
        
        const metadata: Record<string, string> = {}
        frontmatterRaw.split('\n').forEach((line) => {
          const parts = line.split(':')
          if (parts.length >= 2) {
            const key = parts[0].trim()
            const value = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '')
            metadata[key] = value
          }
        })
        
        const slug = file.replace(/\.md$/, '')
        
        documents.push({
          slug,
          title: metadata.title || 'Sem título',
          date: metadata.date || new Date().toISOString(),
          description: metadata.description || '',
          file: metadata.file || undefined,
          content: content
        })
      }
    }
  })

  // Sort: Newest first
  return documents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})
