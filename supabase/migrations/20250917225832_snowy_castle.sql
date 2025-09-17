/*
  # Add savings target to profiles

  1. Schema Changes
    - Add `monthly_savings_target` (numeric) to profiles table
    - Add `savings_target_date` (timestamptz) to profiles table
  
  2. Security
    - Existing RLS policies remain unchanged
    - Users can only update their own savings targets
*/

DO $$
BEGIN
  -- Add monthly_savings_target column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'monthly_savings_target'
  ) THEN
    ALTER TABLE profiles ADD COLUMN monthly_savings_target numeric DEFAULT 0;
  END IF;

  -- Add savings_target_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'savings_target_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN savings_target_date timestamptz DEFAULT now();
  END IF;
END $$;