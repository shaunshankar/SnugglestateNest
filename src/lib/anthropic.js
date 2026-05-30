import Anthropic from '@anthropic-ai/sdk'
import { CATEGORIES } from '../utils/categories'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const CATEGORY_LIST = CATEGORIES.join(', ')

export async function suggestCategory(merchantName) {
  if (!merchantName?.trim()) return null
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `Given the merchant name "${merchantName}", suggest the single most appropriate category from this list: ${CATEGORY_LIST}. Return only the category name, nothing else.`,
        },
      ],
    })
    const suggestion = message.content[0]?.text?.trim()
    return CATEGORIES.includes(suggestion) ? suggestion : null
  } catch {
    return null
  }
}

export async function categorizeTransactions(rows) {
  if (!rows?.length) return []
  const preview = rows.slice(0, 100)
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a financial transaction categoriser. Given a list of bank transactions, categorise each one into exactly one of these categories: ${CATEGORY_LIST}. Return a JSON array with the same rows plus a "category" field added to each. Return only valid JSON, no explanation.\n\nTransactions:\n${JSON.stringify(preview)}`,
        },
      ],
    })
    const text = message.content[0]?.text?.trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return rows.map(r => ({ ...r, category: 'Other' }))
    const categorised = JSON.parse(jsonMatch[0])
    return categorised.map(r => ({
      ...r,
      category: CATEGORIES.includes(r.category) ? r.category : 'Other',
    }))
  } catch {
    return rows.map(r => ({ ...r, category: 'Other' }))
  }
}
