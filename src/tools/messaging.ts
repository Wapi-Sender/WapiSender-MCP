import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

function normalizePhone(input: string): string {
  return input.replace(/\D/g, '')
}

function renderTemplate(template: string, variables: Record<string, string | number | boolean>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in variables)) return match
    return String(variables[key])
  })
}

export const messagingTools = [
  {
    name: 'send_text',
    description: 'Submit a WhatsApp text message. A successful response means the API accepted it, not that the recipient received it.',
    inputSchema: z.object({
      to: z.string().trim().min(1).describe('Phone number with country code, e.g. 5491112345678'),
      message: z.string().min(1).describe('Text message to send'),
    }),
    handler: async ({ to, message }: { to: string; message: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendText/${inst.instance_name}`,
          payload: { number: to, text: message }
        })
        return ok(`Text request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_media',
    description: 'Submit a WhatsApp media message (image, video, audio, or document) with an optional caption.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      url: z.string().url().describe('Publicly accessible URL of the media file'),
      type: z.enum(['image', 'video', 'audio', 'document']).describe('Media type'),
      caption: z.string().optional().describe('Optional caption text'),
      fileName: z.string().optional().describe('Optional file name, especially for documents'),
    }),
    handler: async ({ to, url, type, caption, fileName }: { to: string; url: string; type: string; caption?: string; fileName?: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const payload: Record<string, unknown> = { number: to, mediatype: type, media: url }
        if (caption !== undefined) payload.caption = caption
        if (fileName !== undefined) payload.fileName = fileName
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendMedia/${inst.instance_name}`,
          payload
        })
        return ok(`Media request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_audio',
    description: 'Submit a WhatsApp voice note from a public audio URL.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      url: z.string().url().describe('Publicly accessible URL of the audio file (mp3, ogg, etc.)'),
    }),
    handler: async ({ to, url }: { to: string; url: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendWhatsAppAudio/${inst.instance_name}`,
          payload: { number: to, audio: url }
        })
        return ok(`Voice-note request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_sticker',
    description: 'Submit a WhatsApp sticker from a public image URL.',
    inputSchema: z.object({
      to: z.string().trim().min(1).describe('Phone number with country code'),
      url: z.string().url().describe('Publicly accessible sticker image URL'),
    }),
    handler: async ({ to, url }: { to: string; url: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendSticker/${inst.instance_name}`,
          payload: { number: to, sticker: url },
        })
        return ok(`Sticker request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_location',
    description: 'Send a WhatsApp location pin to a phone number.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      lat: z.number().describe('Latitude'),
      lng: z.number().describe('Longitude'),
      name: z.string().optional().describe('Optional location name/label'),
      address: z.string().optional().describe('Optional street address or location description'),
    }),
    handler: async ({ to, lat, lng, name, address }: { to: string; lat: number; lng: number; name?: string; address?: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const payload: Record<string, unknown> = { number: to, latitude: lat, longitude: lng }
        if (name !== undefined) payload.name = name
        if (address !== undefined) payload.address = address
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendLocation/${inst.instance_name}`,
          payload
        })
        return ok(`Location request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_buttons',
    description: 'Send a WhatsApp interactive button message. Renders up to 3 tappable buttons the recipient can reply with.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      title: z.string().describe('Bold header text of the message'),
      body: z.string().describe('Main message body text'),
      footer: z.string().optional().describe('Small footer text below the buttons'),
      buttons: z.array(z.object({
        id: z.string().describe('Unique button ID returned in the reply'),
        title: z.string().describe('Button label shown to the user'),
      })).min(1).max(3).describe('1–3 buttons'),
    }),
    handler: async ({ to, title, body, footer, buttons }: {
      to: string; title: string; body: string; footer?: string;
      buttons: Array<{ id: string; title: string }>
    }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendButtons/${inst.instance_name}`,
          payload: {
            number: to,
            title,
            description: body,
            footer: footer ?? '',
            buttons: buttons.map(b => ({ type: 'reply', displayText: b.title, id: b.id })),
          }
        })
        return ok(`Button request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_list',
    description: 'Send a WhatsApp interactive list message. Shows a menu button that opens a scrollable list of options.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      title: z.string().describe('Bold header text of the message'),
      body: z.string().describe('Main message body text'),
      footer: z.string().optional().describe('Small footer text'),
      buttonText: z.string().describe('Label on the button that opens the list, e.g. "Choose an option"'),
      sections: z.array(z.object({
        title: z.string().describe('Section heading'),
        rows: z.array(z.object({
          id: z.string().describe('Unique row ID returned in the reply'),
          title: z.string().describe('Row title'),
          description: z.string().optional().describe('Optional row subtitle'),
        })).min(1),
      })).min(1).describe('One or more sections, each with rows'),
    }),
    handler: async ({ to, title, body, footer, buttonText, sections }: {
      to: string; title: string; body: string; footer?: string; buttonText: string;
      sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
    }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendList/${inst.instance_name}`,
          payload: {
            number: to,
            title,
            description: body,
            footerText: footer ?? '',
            buttonText,
            sections: sections.map(section => ({
              title: section.title,
              rows: section.rows.map(row => ({
                rowId: row.id,
                title: row.title,
                ...(row.description !== undefined ? { description: row.description } : {}),
              })),
            })),
          }
        })
        return ok(`List request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_reaction',
    description: 'React to a WhatsApp message with an emoji.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      messageId: z.string().describe('ID of the message to react to'),
      emoji: z.string().describe('Emoji to react with, e.g. "👍" or "❤️". Pass empty string "" to remove a reaction.'),
      fromMe: z.boolean().default(true).describe('Whether the target message was sent by this instance'),
    }),
    handler: async ({ to, messageId, emoji, fromMe }: { to: string; messageId: string; emoji: string; fromMe: boolean }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendReaction/${inst.instance_name}`,
          payload: {
            key: {
              remoteJid: to.includes('@') ? to : `${normalizePhone(to)}@s.whatsapp.net`,
              fromMe,
              id: messageId,
            },
            reaction: emoji,
          }
        })
        return ok(`Reaction request accepted for message ${messageId}; delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_contact_card',
    description: 'Send a WhatsApp contact card (vCard). Shares a contact\'s name, phone number, and optional organization.',
    inputSchema: z.object({
      to: z.string().describe('Phone number of the recipient with country code'),
      contactName: z.string().describe('Full name of the contact to share'),
      contactPhone: z.string().describe('Phone number of the contact to share (with country code)'),
      organization: z.string().optional().describe('Optional organization/company name'),
    }),
    handler: async ({ to, contactName, contactPhone, organization }: {
      to: string; contactName: string; contactPhone: string; organization?: string
    }) => {
      try {
        const inst = session.requireActiveInstance()
        const normalizedContactPhone = normalizePhone(contactPhone)

        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendContact/${inst.instance_name}`,
          payload: {
            number: to,
            contact: [{
              fullName: contactName,
              wuid: normalizedContactPhone,
              phoneNumber: `+${normalizedContactPhone}`,
              ...(organization ? { organization } : {}),
            }]
          }
        })
        return ok(`Contact-card request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_poll',
    description: 'Send a WhatsApp poll with a question and multiple options.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      question: z.string().describe('Poll question shown to the recipient'),
      options: z.array(z.string()).min(2).max(12).describe('Poll options (2-12)'),
      selectableCount: z.number().int().min(1).default(1).describe('How many options the user can select'),
    }),
    handler: async ({ to, question, options, selectableCount }: {
      to: string; question: string; options: string[]; selectableCount: number
    }) => {
      try {
        if (selectableCount > options.length) {
          return err('selectableCount cannot be greater than the number of options.')
        }
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendPoll/${inst.instance_name}`,
          payload: {
            number: to,
            name: question,
            values: options,
            selectableCount,
          },
        })
        return ok(`Poll request accepted for ${to}; recipient delivery is not confirmed.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_bulk_text',
    description: 'Send the same text message to multiple recipients and return a per-recipient result summary.',
    inputSchema: z.object({
      recipients: z.array(z.string()).min(1).max(100).describe('Phone numbers with country code'),
      message: z.string().describe('Text message to send to each recipient'),
      dedupe: z.boolean().default(true).describe('Remove duplicate numbers before sending'),
    }),
    handler: async ({ recipients, message, dedupe }: { recipients: string[]; message: string; dedupe: boolean }) => {
      try {
        const inst = session.requireActiveInstance()
        const targets = dedupe
          ? Array.from(new Set(recipients.map(normalizePhone).filter(Boolean)))
          : recipients.map(normalizePhone).filter(Boolean)

        if (targets.length === 0) return err('No valid recipients provided.')

        const results = await Promise.all(targets.map(async to => {
          try {
            await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
              endpoint: `/message/sendText/${inst.instance_name}`,
              payload: { number: to, text: message }
            })
            return { to, success: true as const }
          } catch (e) {
            return { to, success: false as const, error: e instanceof Error ? e.message : String(e) }
          }
        }))

        const successCount = results.filter(r => r.success).length
        const failCount = results.length - successCount
        return ok(
          `Bulk send complete. Success: ${successCount}, Failed: ${failCount}, Total: ${results.length}\n` +
          JSON.stringify(results, null, 2)
        )
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_template_text',
    description: 'Send personalized text messages by filling {{placeholders}} from per-recipient variables.',
    inputSchema: z.object({
      template: z.string().describe('Template with placeholders, e.g. "Hi {{name}}, your code is {{code}}"'),
      recipients: z.array(z.object({
        to: z.string().describe('Phone number with country code'),
        variables: z.record(z.union([z.string(), z.number(), z.boolean()])).default({})
          .describe('Variables used to fill the template placeholders'),
      })).min(1).max(100),
      dedupe: z.boolean().default(true).describe('Remove duplicate numbers before sending'),
    }),
    handler: async ({ template, recipients, dedupe }: {
      template: string
      recipients: Array<{ to: string; variables: Record<string, string | number | boolean> }>
      dedupe: boolean
    }) => {
      try {
        const inst = session.requireActiveInstance()

        const items = dedupe
          ? Array.from(new Map(recipients.map(r => [normalizePhone(r.to), { ...r, to: normalizePhone(r.to) }])).values())
            .filter(r => r.to)
          : recipients.map(r => ({ ...r, to: normalizePhone(r.to) })).filter(r => r.to)

        if (items.length === 0) return err('No valid recipients provided.')

        const results = await Promise.all(items.map(async ({ to, variables }) => {
          const text = renderTemplate(template, variables ?? {})
          try {
            await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
              endpoint: `/message/sendText/${inst.instance_name}`,
              payload: { number: to, text }
            })
            return { to, success: true as const, text }
          } catch (e) {
            return { to, success: false as const, text, error: e instanceof Error ? e.message : String(e) }
          }
        }))

        const successCount = results.filter(r => r.success).length
        const failCount = results.length - successCount
        return ok(
          `Template send complete. Success: ${successCount}, Failed: ${failCount}, Total: ${results.length}\n` +
          JSON.stringify(results, null, 2)
        )
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
