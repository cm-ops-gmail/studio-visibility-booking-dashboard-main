'use server';
/**
 * @fileOverview A Genkit flow to generate smart suggestions for available time slots in a studio schedule.
 *
 * - suggestSmartSlotDescription - A function that suggests a contextual description for an available time slot.
 * - SmartSlotDescriptionInput - The input type for the suggestSmartSlotDescription function.
 * - SmartSlotDescriptionOutput - The return type for the suggestSmartSlotDescription function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SmartSlotDescriptionInputSchema = z.object({
  studioName: z.string().describe('The name of the studio for which the slot is available.'),
  date: z.string().describe('The date for which the slot is available, e.g., "March 12, 2024".'),
  availableSlotStartTime: z.string().describe('The start time of the available slot, e.g., "11:00 AM".'),
  availableSlotEndTime: z.string().describe('The end time of the available slot, e.g., "01:00 PM".'),
  existingBookings: z.array(
    z.object({
      subject: z.string().describe('The subject or type of the class.'),
      teacher: z.string().optional().describe('The teacher of the class.'),
      startTime: z.string().describe('The start time of the existing booking.'),
      endTime: z.string().describe('The end time of the existing booking.'),
    })
  ).describe('A list of existing bookings for the same studio on the same date.'),
});
export type SmartSlotDescriptionInput = z.infer<typeof SmartSlotDescriptionInputSchema>;

const SmartSlotDescriptionOutputSchema = z.object({
  suggestedDescription: z.string().describe('A smart, AI-generated suggestion for the available time slot.'),
});
export type SmartSlotDescriptionOutput = z.infer<typeof SmartSlotDescriptionOutputSchema>;

export async function suggestSmartSlotDescription(input: SmartSlotDescriptionInput): Promise<SmartSlotDescriptionOutput> {
  return smartSlotDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartSlotDescriptionPrompt',
  input: { schema: SmartSlotDescriptionInputSchema },
  output: { schema: SmartSlotDescriptionOutputSchema },
  prompt: `You are an intelligent scheduling assistant. Your goal is to provide a smart, contextual suggestion for an available time slot in a studio, based on the studio's existing schedule patterns for the day.

Studio: {{{studioName}}}
Date: {{{date}}}
Available Time Slot: From {{{availableSlotStartTime}}} to {{{availableSlotEndTime}}}

Existing bookings for this studio on this date:
{{#each existingBookings}}
- {{this.subject}}{{#if this.teacher}} ({{this.teacher}}){{/if}} from {{this.startTime}} to {{this.endTime}}
{{/each}}
{{#unless existingBookings}}
No other bookings today.
{{/unless}}

Based on the existing bookings, suggest a concise and helpful description for the available time slot. If there's a strong pattern (e.g., mostly yoga classes), suggest something related to that. Otherwise, provide a general "Available for booking" message, possibly with a slight enhancement for the studio.

Example suggestions:
- "Open for Yoga Class"
- "Private Session Available"
- "Studio available for booking - morning slot"
- "Late afternoon slot available"
- "Available for Dance Workshop"

Your suggestion should be no more than 15 words.`,
});

const smartSlotDescriptionFlow = ai.defineFlow(
  {
    name: 'smartSlotDescriptionFlow',
    inputSchema: SmartSlotDescriptionInputSchema,
    outputSchema: SmartSlotDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
