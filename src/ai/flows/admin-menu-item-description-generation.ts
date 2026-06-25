
'use server';
/**
 * @fileOverview A Genkit flow for generating creative and appealing descriptions for menu items.
 *
 * - adminMenuItemDescriptionGeneration - A function that handles the menu item description generation process.
 * - AdminMenuItemDescriptionGenerationInput - The input type for the adminMenuItemDescriptionGeneration function.
 * - AdminMenuItemDescriptionGenerationOutput - The return type for the adminMenuItemDescriptionGeneration function.
 */
/*
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AdminMenuItemDescriptionGenerationInputSchema = z.object({
  itemName: z.string().describe('The name of the menu item.'),
  vegNonVegType: z
    .enum(['Veg', 'Non-Veg'])
    .describe('Whether the menu item is vegetarian or non-vegetarian.'),
  availableTimeSlot: z
    .enum(['Morning', 'Noon'])
    .optional()
    .describe('The time slot for which the menu item is available (Morning or Noon).'),
});
export type AdminMenuItemDescriptionGenerationInput = z.infer<
  typeof AdminMenuItemDescriptionGenerationInputSchema
>;

const AdminMenuItemDescriptionGenerationOutputSchema = z.object({
  description: z.string().describe('A creative and appealing description for the menu item.'),
});
export type AdminMenuItemDescriptionGenerationOutput = z.infer<
  typeof AdminMenuItemDescriptionGenerationOutputSchema
>;

export async function adminMenuItemDescriptionGeneration(
  input: AdminMenuItemDescriptionGenerationInput
): Promise<AdminMenuItemDescriptionGenerationOutput> {
  return adminMenuItemDescriptionGenerationFlow(input);
}

const adminMenuItemDescriptionPrompt = ai.definePrompt({
  name: 'adminMenuItemDescriptionPrompt',
  input: { schema: AdminMenuItemDescriptionGenerationInputSchema },
  output: { schema: AdminMenuItemDescriptionGenerationOutputSchema },
  prompt: `You are a creative copywriter for a food ordering platform called "BacchaBite".
Your goal is to generate enticing, attractive, and appealing descriptions for menu items, suitable for a kid-friendly food brand.
Keep the descriptions concise but mouth-watering, highlighting the item's key features and making customers want to order it.

Generate a creative and appealing description for the following menu item:

Item Name: {{{itemName}}}
Type: {{{vegNonVegType}}}
{{#if availableTimeSlot}}Available Time Slot: {{{availableTimeSlot}}}{{/if}}

Description:`,
});

const adminMenuItemDescriptionGenerationFlow = ai.defineFlow(
  {
    name: 'adminMenuItemDescriptionGenerationFlow',
    inputSchema: AdminMenuItemDescriptionGenerationInputSchema,
    outputSchema: AdminMenuItemDescriptionGenerationOutputSchema,
  },
  async (input) => {
    const { output } = await adminMenuItemDescriptionPrompt(input);
    return output!;
  }
);
*/