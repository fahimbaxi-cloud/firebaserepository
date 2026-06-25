/*'use server';*/
/**
 * @fileOverview A Genkit flow for generating engaging push notification messages for customers.
 *
 * - adminMenuNotificationGeneration - A function that handles the generation of notification messages.
 * - AdminMenuNotificationGenerationInput - The input type for the adminMenuNotificationGeneration function.
 * - AdminMenuNotificationGenerationOutput - The return type for the adminMenuNotificationGeneration function.
 */
/*
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MenuItemSchema = z.object({
  itemName: z.string().catch('').describe('The name of the menu item.'),
  vegNonVegType: z.enum(['Veg', 'Non-Veg']).catch('Veg').describe('Whether the item is vegetarian or non-vegetarian.'),
  timeSlot: z.enum(['Morning', 'Noon']).catch('Morning').describe('The available time slot for the item (Morning or Noon).'),
  price: z.number().catch(0).describe('The price of the menu item.'),
  description: z.string().catch('').describe('A brief description of the menu item.'),
});

const AdminMenuNotificationGenerationInputSchema = z.object({
  menuItems: z.array(MenuItemSchema).describe('A list of daily menu items.'),
  specialOffers: z.string().optional().describe('Any special offers or promotions for the day.'),
  packagePrice: z.number().optional().describe('A special promotional package price for the whole set.'),
});
export type AdminMenuNotificationGenerationInput = z.infer<typeof AdminMenuNotificationGenerationInputSchema>;

const AdminMenuNotificationGenerationOutputSchema = z.object({
  notificationMessage: z.string().describe('The generated engaging push notification message.'),
});
export type AdminMenuNotificationGenerationOutput = z.infer<typeof AdminMenuNotificationGenerationOutputSchema>;

export async function adminMenuNotificationGeneration(input: AdminMenuNotificationGenerationInput): Promise<AdminMenuNotificationGenerationOutput> {
  return adminMenuNotificationGenerationFlow(input);
}

const adminMenuNotificationPrompt = ai.definePrompt({
  name: 'adminMenuNotificationPrompt',
  input: { schema: AdminMenuNotificationGenerationInputSchema },
  output: { schema: AdminMenuNotificationGenerationOutputSchema },
  system: `You are an expert marketing assistant for "BacchaBite", a food ordering and subscription platform for kids. Your goal is to create short, engaging, and personalized push notification messages. Keep the message under 160 characters and use friendly emojis.`,
  prompt: `Here is today's Daily Menu:
{{#each menuItems}}
  - {{this.itemName}} ({{this.vegNonVegType}}, {{this.timeSlot}}): {{this.description}} - Rs {{this.price}}
{{/each}}

{{#if packagePrice}}
SPECIAL PACKAGE PRICE: Rs {{packagePrice}} for the whole set!
{{/if}}

{{#if specialOffers}}
Special Offers: {{{specialOffers}}}
{{/if}}

Craft a catchy push notification message based on this menu. Ensure immediate action and a friendly tone.`,
});

const adminMenuNotificationGenerationFlow = ai.defineFlow(
  {
    name: 'adminMenuNotificationGenerationFlow',
    inputSchema: AdminMenuNotificationGenerationInputSchema,
    outputSchema: AdminMenuNotificationGenerationOutputSchema,
  },
  async (input) => {
    const { output } = await adminMenuNotificationPrompt(input);
    if (!output) {
      throw new Error('AI failed to generate a response');
    }
    return output;
  }
);
*/