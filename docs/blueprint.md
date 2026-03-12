# **App Name**: Studio TimeGrid

## Core Features:

- Google Sheet Data Fetching: Securely connect to the provided Google Sheet URL and service account to retrieve real-time schedule data from the 'Daywise_Class_OPS' tab.
- Dynamic Studio Column Display: Render unique values from the 'Studio' column as dynamic column headers, adapting to the available studios on any given day.
- Daily Calendar View: Display a day-specific calendar grid with a vertical time axis, showcasing classes for each studio based on 'Scheduled Time' and a 2-hour duration.
- Class Detail Display: Within each booked slot, show relevant information from the 'Course', 'Subject', 'Topic', and 'Teacher 1' columns.
- Available Time Slot Visualization: Clearly mark unbooked 2-hour segments as 'Available for booking' within each studio's schedule.
- Date Navigation: Allow users to navigate between different dates to view past or future schedules, with the current day's schedule shown by default.
- Smart Slot Description Tool: Utilize generative AI to suggest contextual descriptions for 'Available for booking' time slots, making them more informative (e.g., 'Open for Yoga Class' or 'Private Session Available') based on surrounding studio bookings.

## Style Guidelines:

- Primary color: A thoughtful, deep periwinkle blue (#403399), suggesting reliability and focus for a data-centric dashboard. Its richness ensures good contrast against lighter elements.
- Background color: A very light, subtle periwinkle (#F6F5FB) that creates a serene and clean canvas for content, maintaining a harmonious feel with the primary color while being unintrusive.
- Accent color: A vibrant yet soft lavender-blue (#82A2ED), providing an energetic highlight for interactive elements and call-to-actions, designed to draw attention without being overwhelming.
- Body and headline font: 'Inter' (sans-serif) for its modern, clean, and highly readable design, ensuring clarity and objective presentation of schedule data and dashboard elements.
- Employ a minimalist set of clear, line-style icons for navigation (e.g., arrows for date change) and interaction (e.g., plus signs for booking, calendar for date selection) to maintain a professional and uncluttered aesthetic.
- Implement a responsive, grid-based layout that mimics a traditional calendar, optimized for displaying multiple studio schedules and time slots cleanly across various screen sizes. Maintain consistent padding and spacing for visual hierarchy.
- Subtle, smooth transition animations for date changes or when displaying/hiding detailed class information. These should enhance the user experience by providing visual feedback without causing distraction.