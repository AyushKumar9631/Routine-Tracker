-- Lets the user customize the LeetCode deadline notification's wording.
-- Null means "use the default template" (see DEFAULT_NOTIFICATION_TEMPLATE
-- in lib/notification-template.ts). Available placeholders when writing a
-- custom template: {question} (title), {number} (LeetCode question number),
-- {difficulty} (Easy/Medium/Hard).

alter table leetcode_potd_config
  add column if not exists notification_template text;
