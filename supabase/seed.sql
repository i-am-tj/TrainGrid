-- GLOBAL routines generated from data/templates/*.md.
-- Do not edit by hand: run `npm run seed:generate` after changing a template.
-- Generic training content only. No personal data.

begin;

insert into public.routines (id, scope, owner_user_id, slug, name, category, description)
values
  ('36052cbe-2908-5711-aa11-d7799365ee8c', 'GLOBAL', null, 'easy-run', 'Easy Run', 'running', 'Easy aerobic run. Keep it conversational.'),
  ('3a563823-addb-52bd-8fc9-30f2dd097101', 'GLOBAL', null, 'long-run', 'Long Run', 'running', 'Weekend endurance. Easy to steady.'),
  ('7e1cbd2e-12c9-5354-8281-52de7a3088af', 'GLOBAL', null, 'lower-a', 'Lower A', 'strength', 'Squat-pattern lower body.'),
  ('c28195e4-501b-5c37-9869-2d7596fdf6cc', 'GLOBAL', null, 'lower-b', 'Lower B', 'strength', 'Hinge-pattern lower body.'),
  ('9dc808bf-9b3b-5545-a3b0-9ad34f81680d', 'GLOBAL', null, 'lower-cooldown', 'Lower-Body Cooldown', 'other', 'Easy stretch after squats or hinges.'),
  ('b748adcd-782f-5574-ad5d-893bf2431d67', 'GLOBAL', null, 'lower-warmup', 'Lower-Body Warm-up', 'other', 'Before squats or hinges. Then ramp the first compound.'),
  ('15efe997-5b10-5904-bd42-ab0f52a588b2', 'GLOBAL', null, 'plyometrics-a', 'Plyometrics A — Vertical Power', 'plyometrics', 'Jumps for height and stiffness. Quality over volume.'),
  ('d7ad0315-5598-59ad-a012-2ac016536b3b', 'GLOBAL', null, 'plyometrics-b', 'Plyometrics B — Running / Elastic Power', 'plyometrics', 'Horizontal and elastic work for running.'),
  ('517101c3-8744-5c8a-b27f-5fa56bc65ca0', 'GLOBAL', null, 'recovery-run', 'Recovery Run', 'running', 'Short and truly easy. Shake-out, not training stress.'),
  ('6904c7b9-888a-5516-9273-7317eb7b000f', 'GLOBAL', null, 'running-cooldown', 'Running Cooldown', 'other', 'Easy walk/jog and a few stretches.'),
  ('36c4128b-1584-5aaf-851d-6b9453a580cb', 'GLOBAL', null, 'running-warmup', 'Running Warm-up', 'other', 'Before a quality run. Easy jog plus drills and strides.'),
  ('a6779907-87d6-5d3d-9c16-407851fd35e0', 'GLOBAL', null, 'speed-run', 'Speed / Power', 'running', 'Short, sharp efforts with full recovery.'),
  ('412b2646-f820-5bb8-8f8b-2d0f054e9027', 'GLOBAL', null, 'tempo-run', 'Tempo / Threshold', 'running', 'Comfortably hard, sustainable effort.'),
  ('9ff37b42-f22e-5bd0-aee6-ad646167adba', 'GLOBAL', null, 'upper-a', 'Upper A', 'strength', 'Horizontal push/pull emphasis.'),
  ('17be775f-608a-59cb-a140-9a25d0ceae96', 'GLOBAL', null, 'upper-b', 'Upper B', 'strength', 'Vertical push/pull emphasis.'),
  ('2f047c8e-ed0e-5c03-beaa-e4a5ca3a4460', 'GLOBAL', null, 'upper-cooldown', 'Upper-Body Cooldown', 'other', 'Easy stretch after pressing and pulling.'),
  ('2f9ea8cc-4aab-5150-8132-305171fe4fa0', 'GLOBAL', null, 'upper-warmup', 'Upper-Body Warm-up', 'other', 'Shoulder and scapular prep, then ramp the first press or pull.'),
  ('ea5fd1b5-07ec-5142-8a26-853848cb8df4', 'GLOBAL', null, 'vo2-run', 'VO2max', 'running', 'Hard intervals. Controlled, not a sprint.')
on conflict (id) do update
  set slug = excluded.slug,
      name = excluded.name,
      category = excluded.category,
      description = excluded.description;

delete from public.workout_items
 where routine_id in ('36052cbe-2908-5711-aa11-d7799365ee8c', '3a563823-addb-52bd-8fc9-30f2dd097101', '7e1cbd2e-12c9-5354-8281-52de7a3088af', 'c28195e4-501b-5c37-9869-2d7596fdf6cc', '9dc808bf-9b3b-5545-a3b0-9ad34f81680d', 'b748adcd-782f-5574-ad5d-893bf2431d67', '15efe997-5b10-5904-bd42-ab0f52a588b2', 'd7ad0315-5598-59ad-a012-2ac016536b3b', '517101c3-8744-5c8a-b27f-5fa56bc65ca0', '6904c7b9-888a-5516-9273-7317eb7b000f', '36c4128b-1584-5aaf-851d-6b9453a580cb', 'a6779907-87d6-5d3d-9c16-407851fd35e0', '412b2646-f820-5bb8-8f8b-2d0f054e9027', '9ff37b42-f22e-5bd0-aee6-ad646167adba', '17be775f-608a-59cb-a140-9a25d0ceae96', '2f047c8e-ed0e-5c03-beaa-e4a5ca3a4460', '2f9ea8cc-4aab-5150-8132-305171fe4fa0', 'ea5fd1b5-07ec-5142-8a26-853848cb8df4')
   and id not in ('c524a19a-9188-5e3e-b374-42fe40834240', '25c1334d-e5b6-579f-9dd9-64f095d70f57', '7bf6e183-f300-52a8-9b13-592509ffac72', 'ed875a7f-f1b1-58c7-9107-c3dc7f05ad44', '0ac34507-a597-5164-befd-152a2d9e067f', 'e6966dcb-31f5-5f66-b469-56c59fc74257', 'c501beb1-4ae0-5a58-bd9c-2b75b87ee260', 'cbe16aa6-36db-50f1-92ca-e8c101596b8a', '884a8b7a-a3d3-5ba8-839b-e32c55e30e6e', 'a1003266-a828-52fd-a78a-ab6cd22ab612', '346f0bcc-ca37-5c2f-8c21-d443e81f416b', 'fe26e89d-3ea6-57a1-9d2e-a38028ca337d', 'e04f059a-271b-5eba-91bb-301e5c1b32d5', '7d57dcba-e9bc-50f9-8fc0-6d3df0c1abc9', '9cbb73bd-f51b-5a64-a97b-b6dc25050379', '46d0aaf4-1104-5747-a094-11e9259019f4', '3664a567-9b2a-575f-a87e-130a213489ab', '7ef2e817-3574-5112-a51a-52aee4f8688e', '2520529a-8fe1-5cc3-986c-dc1f1f3de97d', '6385996b-d101-5f2b-b19d-e59e30cc8b70', '9983cd95-b471-5f7b-bf61-675d9eb72ff5', '3b1298ce-6919-57ca-aaf3-ccdc2b77ddef', '40242401-ab90-594b-916c-cb35c737f022', 'd627b31f-ed48-55b9-a4e4-513bb636e4c3', '223b008e-151c-5d2a-a5b1-e2819fb990ec', '8643d1a5-6edd-5bcf-a628-ff899dead8ba', 'd91f0ab7-9ba2-5555-ac8d-b6d8db5452d5', 'a1c495aa-7b23-5f50-ab57-ddd4de16e851', 'c51cd980-3047-5708-bac8-3b00c5a4c1d0', 'ac4a64f6-4d93-5f7e-9e78-96cd13bdbacf', '92d8ae6d-4c6a-530c-9bf1-49d3510bfd76', '4107726f-7629-5016-8f80-874f2a6e18c5', '9b5758ce-e78d-55cc-9663-d7c58082301c', '05bf94d0-2a98-5839-a1d2-be6c4dd37581', 'ab9f2267-3bdf-55de-bf7c-ac25539044af', '717f0428-5073-5659-a4be-d87e9f866d2d', 'c69fa335-3c05-5961-9daa-dbf46b444ac6', '7bd4335a-c8d8-5e59-b1f0-62f07716e200', '318c58be-df15-574a-8c56-63462cb53c37', '65ec1771-0156-5753-94fd-302c63f9fd04', '24f76a3f-117a-59a8-8011-aebb2dad183a', '3172bd16-8dc0-522f-981e-3beed4578a87', '5f68e26f-1bed-5545-aa4f-e60a6ba9b7e9', 'f71207aa-3582-5b45-a1be-e9fa340a63d0', '6e7b23f2-8932-56fb-86ad-e7843d6bb3cd', '53c06b85-566f-5ae6-8617-e1e12096053c', '222d8940-9c71-5163-8400-1296c97a7e65', '8631775f-93cb-5a62-9617-8f07f9e32f20', '9613097c-d688-5bb6-a857-739a0433a910', '863f7c32-cddb-5b4e-a99d-a0cc75f49223', '07b13e3e-37b7-5fb2-8b72-ef094951bf55', '3df387ef-c9ee-5815-9489-46d21a9d87c3', 'e31b1cd2-b624-512a-8fdd-2b549ab9c2cd', 'be0250ff-b6c4-5d5a-b474-7efb93ab714a', '46a70ca0-0e38-547c-b1a2-a1cb0638d55c', '0efee137-2ba2-53a8-9576-dae4bacea85e', '8828924e-b049-5fb1-ab38-6d1113e4142f', '3ee59f1a-b5d1-5e22-9862-a90d30885550', '14f0ab97-4a03-5b05-9545-0d19ded4d2d0', '3b7cdaf7-6812-54db-bc36-eea327922dab', 'e07792e0-9ea1-5e30-8f31-6010a1b743bd', '8acc8e6f-1bbd-540a-a620-cb9e208c1e4f', '68ec8364-8d45-54a2-be06-b1eb7fed4512', '4897652e-b008-530c-973f-33e057a748d6', '103a1baa-f7ba-5a0b-9cdd-6e1f1faa7c22', '0ad58148-bfe2-559b-86c3-8be915b41749', '7f31dfc5-d089-5a30-b64e-adfdf9ad0370', '9c1f6099-0eab-571d-b2c3-caa7b45588d5', 'cb24dbbb-3b2a-55fc-8632-add5ef87b226', '45a53158-b505-5ab8-adcd-8cfd37a33582', '11d2747e-86bf-5107-9f25-06cdb57fe462', '66793e58-cb86-5291-bf22-cc40477f054c', '2d98afb9-1e7b-5696-b083-b245e3e331da', '2631b2bc-86da-5c19-8c50-052bd8f4e83b', '8653c875-cd9a-57c5-bc06-7aa213de3dee', '6716406d-13fe-5f27-9718-295c82302dc1', '81c57b29-ccb2-535d-bec3-cfc8054ab4e3', '1f8cfcba-4e93-5441-b754-225641e27dbe', '915b180f-91cd-5337-9575-e7c41a3d665e', '89aff619-6185-5c1c-9805-10b47ede76f4', 'f04a8d62-1067-5f8f-9143-e9b6a241defe', '59d9e252-ad22-5fbb-ace1-1efdcc8f79af', 'f800bd97-c34f-5c32-9ec0-c1a638618f30', 'b8fcae80-34cd-5770-8178-7ba1b6c3dc61', '8d956444-88e8-5ebb-bf7f-65a57423a178', '1d0bce05-5541-566d-bed5-a9b5033c50ab', '9de9a6dd-d5ee-5d4c-8485-9455a9fc5b41', '6c5a9907-3ce1-5454-bd87-f58a9bdcb8b2', '10e3b59a-1020-5cc2-b956-be559f9e20e0', 'de2854b4-b896-5b03-9692-9c55ee39b929', 'dba6c354-e8e1-57be-a31d-9bbe34842d8b', '9dacfe42-0680-5cf9-bd8c-6921dc4aac3f', '099d2ae5-648f-57f0-974d-366be9991b2e', 'd09f0fe4-dff7-5967-99cb-1cd59b7a0293', '60be9955-da6a-54f7-967e-a97756f50036', 'afd335fd-d428-5e30-98bf-7338a9ed7d89');

insert into public.workout_items
  (id, routine_id, name, instruction, rest, target, notes, equipment, video_url, sort_order)
values
  ('c524a19a-9188-5e3e-b374-42fe40834240', '36052cbe-2908-5711-aa11-d7799365ee8c', 'Warm-up', 'Easy jog 3–5 min until breathing settles.', '', '', '', '{}'::text[], null, 0),
  ('25c1334d-e5b6-579f-9dd9-64f095d70f57', '36052cbe-2908-5711-aa11-d7799365ee8c', 'Main', '30–50 min easy. Conversational. Nasal breathing is a useful governor.', '', 'RPE 3–4 / 10', '', '{}'::text[], null, 1),
  ('7bf6e183-f300-52a8-9b13-592509ffac72', '36052cbe-2908-5711-aa11-d7799365ee8c', 'Recovery', 'None beyond staying easy. If you surge, slow down.', '', '', '', '{}'::text[], null, 2),
  ('ed875a7f-f1b1-58c7-9107-c3dc7f05ad44', '36052cbe-2908-5711-aa11-d7799365ee8c', 'Cooldown', 'Walk 2–3 min.', '', '', '', '{}'::text[], null, 3),
  ('0ac34507-a597-5164-befd-152a2d9e067f', '36052cbe-2908-5711-aa11-d7799365ee8c', 'Progression', 'Add 5–10 min when the run feels genuinely easy, not when the calendar says so.', '', '', '', '{}'::text[], null, 4),
  ('e6966dcb-31f5-5f66-b469-56c59fc74257', '3a563823-addb-52bd-8fc9-30f2dd097101', 'Warm-up', 'First 10 min very easy. Shuffle if needed.', '', '', '', '{}'::text[], null, 0),
  ('c501beb1-4ae0-5a58-bd9c-2b75b87ee260', '3a563823-addb-52bd-8fc9-30f2dd097101', 'Main', '60–90 min easy. Optional last 10 min slightly quicker if you still feel smooth.', '', 'RPE 3–5 / 10', '', '{}'::text[], null, 1),
  ('cbe16aa6-36db-50f1-92ca-e8c101596b8a', '3a563823-addb-52bd-8fc9-30f2dd097101', 'Recovery', 'Walk water stops as needed. Do not turn this into a workout.', '', '', '', '{}'::text[], null, 2),
  ('884a8b7a-a3d3-5ba8-839b-e32c55e30e6e', '3a563823-addb-52bd-8fc9-30f2dd097101', 'Cooldown', 'Walk 5 min.', '', '', '', '{}'::text[], null, 3),
  ('a1003266-a828-52fd-a78a-ab6cd22ab612', '3a563823-addb-52bd-8fc9-30f2dd097101', 'Progression', 'Add 10 min every 1–2 weeks, then take a shorter long run.', '', '', '', '{}'::text[], null, 4),
  ('346f0bcc-ca37-5c2f-8c21-d443e81f416b', '7e1cbd2e-12c9-5354-8281-52de7a3088af', 'Back Squat', '4 × 5–6', '2–3 min', 'RPE 7–8', 'Controlled descent. Drive aggressively out of the bottom.', array['barbell']::text[], null, 0),
  ('fe26e89d-3ea6-57a1-9d2e-a38028ca337d', '7e1cbd2e-12c9-5354-8281-52de7a3088af', 'Pause Squat', '3 × 4', '2 min', 'RPE 7', '2-second pause in the hole. Stay braced.', array['barbell']::text[], null, 1),
  ('e04f059a-271b-5eba-91bb-301e5c1b32d5', '7e1cbd2e-12c9-5354-8281-52de7a3088af', 'Romanian Deadlift', '3 × 8–10', '2 min', 'RPE 7', 'Keep the bar close. Soft knees, long hamstrings.', array['barbell']::text[], null, 2),
  ('7d57dcba-e9bc-50f9-8fc0-6d3df0c1abc9', '7e1cbd2e-12c9-5354-8281-52de7a3088af', 'Bulgarian Split Squat', '3 × 8 / side', '90 sec', 'RPE 7–8', 'Front foot planted. Control the descent.', array['dumbbell', 'bench']::text[], null, 3),
  ('9cbb73bd-f51b-5a64-a97b-b6dc25050379', '7e1cbd2e-12c9-5354-8281-52de7a3088af', 'Walking Lunge', '2 × 10 / side', '90 sec', '', 'Even steps. Torso tall.', array['dumbbell']::text[], null, 4),
  ('46d0aaf4-1104-5747-a094-11e9259019f4', '7e1cbd2e-12c9-5354-8281-52de7a3088af', 'Calf Raise', '3 × 10–15', '60 sec', '', 'Full range. Pause at the top.', array['dumbbell']::text[], null, 5),
  ('3664a567-9b2a-575f-a87e-130a213489ab', 'c28195e4-501b-5c37-9869-2d7596fdf6cc', 'Deadlift', '3 × 4–6', '3 min', 'RPE 7–8', 'Neutral spine. Push the floor away.', array['barbell']::text[], null, 0),
  ('7ef2e817-3574-5112-a51a-52aee4f8688e', 'c28195e4-501b-5c37-9869-2d7596fdf6cc', 'Front Squat', '3 × 6–8', '2–3 min', 'RPE 7', 'Elbows high. Sit between the hips.', array['barbell']::text[], null, 1),
  ('2520529a-8fe1-5cc3-986c-dc1f1f3de97d', 'c28195e4-501b-5c37-9869-2d7596fdf6cc', 'Hip Thrust', '3 × 8–12', '90 sec', 'RPE 7–8', 'Pause at lockout. Ribs down.', array['barbell', 'bench']::text[], null, 2),
  ('6385996b-d101-5f2b-b19d-e59e30cc8b70', 'c28195e4-501b-5c37-9869-2d7596fdf6cc', 'Bulgarian Split Squat', '3 × 8 / side', '90 sec', '', 'Slight forward lean is fine. Keep the front heel down.', array['dumbbell', 'bench']::text[], null, 3),
  ('9983cd95-b471-5f7b-bf61-675d9eb72ff5', 'c28195e4-501b-5c37-9869-2d7596fdf6cc', 'Hamstring Curl', '3 × 10–12', '75 sec', '', 'Control the eccentric.', array['machine']::text[], null, 4),
  ('3b1298ce-6919-57ca-aaf3-ccdc2b77ddef', 'c28195e4-501b-5c37-9869-2d7596fdf6cc', 'Back Extension', '2 × 10–12', '60 sec', '', 'Squeeze glutes at the top. Do not hyperextend the neck.', array['bodyweight']::text[], null, 5),
  ('40242401-ab90-594b-916c-cb35c737f022', '9dc808bf-9b3b-5545-a3b0-9ad34f81680d', 'Easy walk', '3–5 min', '', '', '', '{}'::text[], null, 0),
  ('d627b31f-ed48-55b9-a4e4-513bb636e4c3', '9dc808bf-9b3b-5545-a3b0-9ad34f81680d', 'Hip Flexor Stretch', '30–45 sec / side', '', '', '', '{}'::text[], null, 1),
  ('223b008e-151c-5d2a-a5b1-e2819fb990ec', '9dc808bf-9b3b-5545-a3b0-9ad34f81680d', 'Figure-4 Glute Stretch', '30–45 sec / side', '', '', '', '{}'::text[], null, 2),
  ('8643d1a5-6edd-5bcf-a628-ff899dead8ba', '9dc808bf-9b3b-5545-a3b0-9ad34f81680d', 'Hamstring Stretch', '30–45 sec / side', '', '', '', '{}'::text[], null, 3),
  ('d91f0ab7-9ba2-5555-ac8d-b6d8db5452d5', '9dc808bf-9b3b-5545-a3b0-9ad34f81680d', 'Couch Stretch or Quad Stretch', '30–45 sec / side', '', '', 'Keep the ribs down.', '{}'::text[], null, 4),
  ('a1c495aa-7b23-5f50-ab57-ddd4de16e851', 'b748adcd-782f-5574-ad5d-893bf2431d67', 'Bodyweight Squat', '2 × 10', '', '', '', array['bodyweight']::text[], null, 0),
  ('c51cd980-3047-5708-bac8-3b00c5a4c1d0', 'b748adcd-782f-5574-ad5d-893bf2431d67', 'Reverse Lunge', '2 × 8 / side', '', '', '', array['bodyweight']::text[], null, 1),
  ('ac4a64f6-4d93-5f7e-9e78-96cd13bdbacf', 'b748adcd-782f-5574-ad5d-893bf2431d67', 'Glute Bridge', '2 × 12', '', '', 'Pause at the top.', array['bodyweight']::text[], null, 2),
  ('92d8ae6d-4c6a-530c-9bf1-49d3510bfd76', 'b748adcd-782f-5574-ad5d-893bf2431d67', 'Leg Swings', '10 / side', '', '', '', array['bodyweight']::text[], null, 3),
  ('4107726f-7629-5016-8f80-874f2a6e18c5', 'b748adcd-782f-5574-ad5d-893bf2431d67', 'Ankle Rocks', '10 / side', '', '', 'Knee over toes, heel down.', array['bodyweight']::text[], null, 4),
  ('9b5758ce-e78d-55cc-9663-d7c58082301c', 'b748adcd-782f-5574-ad5d-893bf2431d67', 'Ramp-up sets', '2–4 light sets of the first compound lift. Add load, keep reps crisp.', '', '', '', '{}'::text[], null, 5),
  ('05bf94d0-2a98-5839-a1d2-be6c4dd37581', '15efe997-5b10-5904-bd42-ab0f52a588b2', 'Pogo Jumps', '3 × 20', '45–60 sec', '', 'Quick ground contact. Think stiff ankles.', array['bodyweight']::text[], null, 0),
  ('ab9f2267-3bdf-55de-bf7c-ac25539044af', '15efe997-5b10-5904-bd42-ab0f52a588b2', 'Countermovement Jumps', '3 × 5', '90 sec', '', 'Dip and go. Soft, quiet landings.', array['bodyweight']::text[], null, 1),
  ('717f0428-5073-5659-a4be-d87e9f866d2d', '15efe997-5b10-5904-bd42-ab0f52a588b2', 'Box Jumps', '4 × 4', '2 min', '', 'Step down. Do not rebound off the box.', array['plyometric-box']::text[], null, 2),
  ('c69fa335-3c05-5961-9daa-dbf46b444ac6', '15efe997-5b10-5904-bd42-ab0f52a588b2', 'Split-Squat Jumps', '3 × 5 / side', '90 sec', '', 'Upright torso. Switch or stay on one side, then swap.', array['bodyweight']::text[], null, 3),
  ('7bd4335a-c8d8-5e59-b1f0-62f07716e200', '15efe997-5b10-5904-bd42-ab0f52a588b2', 'Broad Jumps', '3 × 4', '2 min', '', 'Stick the landing. Reset between reps.', array['bodyweight']::text[], null, 4),
  ('318c58be-df15-574a-8c56-63462cb53c37', 'd7ad0315-5598-59ad-a012-2ac016536b3b', 'A-Skips', '3 × 20m', 'walk back', '', 'Rhythm first. Dorsiflex and bounce.', array['bodyweight']::text[], null, 0),
  ('65ec1771-0156-5753-94fd-302c63f9fd04', 'd7ad0315-5598-59ad-a012-2ac016536b3b', 'Bounds', '3 × 20m', 'walk back', '', 'Cover ground. Soft, springy contacts.', array['bodyweight']::text[], null, 1),
  ('24f76a3f-117a-59a8-8011-aebb2dad183a', 'd7ad0315-5598-59ad-a012-2ac016536b3b', 'Single-Leg Pogos', '3 × 10 / side', '60 sec', '', 'Small amplitude. Stay tall.', array['bodyweight']::text[], null, 2),
  ('3172bd16-8dc0-522f-981e-3beed4578a87', 'd7ad0315-5598-59ad-a012-2ac016536b3b', 'Lateral Bounds', '3 × 6 / side', '90 sec', '', 'Stick each landing before the next bound.', array['bodyweight']::text[], null, 3),
  ('5f68e26f-1bed-5545-aa4f-e60a6ba9b7e9', 'd7ad0315-5598-59ad-a012-2ac016536b3b', 'Acceleration Strides', '4 × 60m', 'walk back', '', 'Build for 40m, float 20m. Not a max sprint.', array['bodyweight']::text[], null, 4),
  ('f71207aa-3582-5b45-a1be-e9fa340a63d0', '517101c3-8744-5c8a-b27f-5fa56bc65ca0', 'Warm-up', '2–3 min walk, then ease into a jog.', '', '', '', '{}'::text[], null, 0),
  ('6e7b23f2-8932-56fb-86ad-e7843d6bb3cd', '517101c3-8744-5c8a-b27f-5fa56bc65ca0', 'Main', '20–30 min very easy. Slower than Easy Run is correct.', '', 'RPE 2–3 / 10', '', '{}'::text[], null, 1),
  ('53c06b85-566f-5ae6-8617-e1e12096053c', '517101c3-8744-5c8a-b27f-5fa56bc65ca0', 'Recovery', 'If it stops feeling easy, walk.', '', '', '', '{}'::text[], null, 2),
  ('222d8940-9c71-5163-8400-1296c97a7e65', '517101c3-8744-5c8a-b27f-5fa56bc65ca0', 'Cooldown', 'Walk 2–3 min. Easy breathing.', '', '', '', '{}'::text[], null, 3),
  ('8631775f-93cb-5a62-9617-8f07f9e32f20', '517101c3-8744-5c8a-b27f-5fa56bc65ca0', 'Progression', 'Keep this short. Fitness comes from the other days.', '', '', '', '{}'::text[], null, 4),
  ('9613097c-d688-5bb6-a857-739a0433a910', '6904c7b9-888a-5516-9273-7317eb7b000f', 'Easy walk/jog', '5–10 min', '', '', '', '{}'::text[], null, 0),
  ('863f7c32-cddb-5b4e-a99d-a0cc75f49223', '6904c7b9-888a-5516-9273-7317eb7b000f', 'Calf Stretch', '30–45 sec / side', '', '', '', '{}'::text[], null, 1),
  ('07b13e3e-37b7-5fb2-8b72-ef094951bf55', '6904c7b9-888a-5516-9273-7317eb7b000f', 'Hip Flexor Stretch', '30–45 sec / side', '', '', '', '{}'::text[], null, 2),
  ('3df387ef-c9ee-5815-9489-46d21a9d87c3', '6904c7b9-888a-5516-9273-7317eb7b000f', 'Hamstring Stretch', '30–45 sec / side', '', '', '', '{}'::text[], null, 3),
  ('e31b1cd2-b624-512a-8fdd-2b549ab9c2cd', '6904c7b9-888a-5516-9273-7317eb7b000f', 'Easy breathing', '2 min', '', '', 'In through the nose, longer exhale.', '{}'::text[], null, 4),
  ('be0250ff-b6c4-5d5a-b474-7efb93ab714a', '36c4128b-1584-5aaf-851d-6b9453a580cb', 'Easy Jog', '5–10 min', '', '', '', '{}'::text[], null, 0),
  ('46a70ca0-0e38-547c-b1a2-a1cb0638d55c', '36c4128b-1584-5aaf-851d-6b9453a580cb', 'Leg Swings', '10 / side', '', '', 'Front-to-back and side-to-side.', array['bodyweight']::text[], null, 1),
  ('0efee137-2ba2-53a8-9576-dae4bacea85e', '36c4128b-1584-5aaf-851d-6b9453a580cb', 'Walking Lunges', '10 / side', '', '', 'Long posture. Gentle stretch, not a workout.', array['bodyweight']::text[], null, 2),
  ('8828924e-b049-5fb1-ab38-6d1113e4142f', '36c4128b-1584-5aaf-851d-6b9453a580cb', 'A-Skips', '2 × 20m', '', '', '', array['bodyweight']::text[], null, 3),
  ('3ee59f1a-b5d1-5e22-9862-a90d30885550', '36c4128b-1584-5aaf-851d-6b9453a580cb', 'High Knees', '2 × 20m', '', '', '', array['bodyweight']::text[], null, 4),
  ('14f0ab97-4a03-5b05-9545-0d19ded4d2d0', '36c4128b-1584-5aaf-851d-6b9453a580cb', 'Strides', '3 × 60m', '', '', 'Relax the arms. Walk back.', '{}'::text[], null, 5),
  ('3b7cdaf7-6812-54db-bc36-eea327922dab', 'a6779907-87d6-5d3d-9c16-407851fd35e0', 'Warm-up', '1 km easy jog
Dynamic drills: leg swings, A-skips, high knees
4 × 20s relaxed strides with walk-back', '', '', '', '{}'::text[], null, 0),
  ('e07792e0-9ea1-5e30-8f31-6010a1b743bd', 'a6779907-87d6-5d3d-9c16-407851fd35e0', 'Main', '6–8 × 150–200m fast
Stay tall and snappy. Not a flattening sprint.', '', 'RPE 8–9 / 10, full recovery between reps', '', '{}'::text[], null, 1),
  ('8acc8e6f-1bbd-540a-a620-cb9e208c1e4f', 'a6779907-87d6-5d3d-9c16-407851fd35e0', 'Recovery', 'Walk or very easy jog until you could go again cleanly (often 2–3 min).', '', '', '', '{}'::text[], null, 2),
  ('68ec8364-8d45-54a2-be06-b1eb7fed4512', 'a6779907-87d6-5d3d-9c16-407851fd35e0', 'Cooldown', '1 km easy jog', '', '', '', '{}'::text[], null, 3),
  ('4897652e-b008-530c-973f-33e057a748d6', 'a6779907-87d6-5d3d-9c16-407851fd35e0', 'Progression', 'Keep the distance short. Add 1–2 reps before you add speed.', '', '', '', '{}'::text[], null, 4),
  ('103a1baa-f7ba-5a0b-9cdd-6e1f1faa7c22', '412b2646-f820-5bb8-8f8b-2d0f054e9027', 'Warm-up', '10 min easy jog
2 × 20s strides', '', '', '', '{}'::text[], null, 0),
  ('0ad58148-bfe2-559b-86c3-8be915b41749', '412b2646-f820-5bb8-8f8b-2d0f054e9027', 'Main', '20 min continuous tempo, or 3 × 8 min with 2 min jog
Even breathing. You can speak a short phrase, not a sentence.', '', 'RPE 6–7 / 10', '', '{}'::text[], null, 1),
  ('7f31dfc5-d089-5a30-b64e-adfdf9ad0370', '412b2646-f820-5bb8-8f8b-2d0f054e9027', 'Recovery', 'Easy jog between tempo blocks if you split them.', '', '', '', '{}'::text[], null, 2),
  ('9c1f6099-0eab-571d-b2c3-caa7b45588d5', '412b2646-f820-5bb8-8f8b-2d0f054e9027', 'Cooldown', '8–10 min easy jog', '', '', '', '{}'::text[], null, 3),
  ('cb24dbbb-3b2a-55fc-8632-add5ef87b226', '412b2646-f820-5bb8-8f8b-2d0f054e9027', 'Progression', '20 min → 25 min, or add a third block before you chase pace.', '', '', '', '{}'::text[], null, 4),
  ('45a53158-b505-5ab8-adcd-8cfd37a33582', '9ff37b42-f22e-5bd0-aee6-ad646167adba', 'Bench Press', '4 × 5–6', '2–3 min', 'RPE 7–8', 'Feet planted. Control the touch, press evenly.', array['barbell', 'bench']::text[], null, 0),
  ('11d2747e-86bf-5107-9f25-06cdb57fe462', '9ff37b42-f22e-5bd0-aee6-ad646167adba', 'Bent-over Row', '3 × 8–10', '2 min', 'RPE 7–8', 'Hinge and brace. Pull to the lower ribs.', array['barbell']::text[], null, 1),
  ('66793e58-cb86-5291-bf22-cc40477f054c', '9ff37b42-f22e-5bd0-aee6-ad646167adba', 'Overhead Press', '3 × 8–10', '2 min', 'RPE 7', 'Glutes tight. Head through at the top.', array['barbell']::text[], null, 2),
  ('2d98afb9-1e7b-5696-b083-b245e3e331da', '9ff37b42-f22e-5bd0-aee6-ad646167adba', 'Chest-supported Row', '3 × 10–12', '90 sec', '', 'Pause one second at the squeeze.', array['dumbbell', 'bench']::text[], null, 3),
  ('2631b2bc-86da-5c19-8c50-052bd8f4e83b', '9ff37b42-f22e-5bd0-aee6-ad646167adba', 'Push-up', '2 × 8–12', '75 sec', '', 'Body in a line. Full lockout.', array['bodyweight']::text[], null, 4),
  ('8653c875-cd9a-57c5-bc06-7aa213de3dee', '9ff37b42-f22e-5bd0-aee6-ad646167adba', 'Face Pull', '2 × 12–15', '60 sec', '', 'Lead with the elbows. Light and crisp.', array['cable']::text[], null, 5),
  ('6716406d-13fe-5f27-9718-295c82302dc1', '17be775f-608a-59cb-a140-9a25d0ceae96', 'Overhead Press', '4 × 5–6', '2–3 min', 'RPE 7–8', 'Brace hard. Bar path close to the face.', array['barbell']::text[], null, 0),
  ('81c57b29-ccb2-535d-bec3-cfc8054ab4e3', '17be775f-608a-59cb-a140-9a25d0ceae96', 'Pull-up', '3 × 6–10', '2 min', 'RIR 2–3', 'Full hang to chest toward the bar. Add load only if you own every rep.', array['pull-up-bar']::text[], null, 1),
  ('1f8cfcba-4e93-5441-b754-225641e27dbe', '17be775f-608a-59cb-a140-9a25d0ceae96', 'Incline Dumbbell Press', '3 × 8–10', '2 min', 'RPE 7–8', '30–45° bench. Lower with control.', array['dumbbell', 'bench']::text[], null, 2),
  ('915b180f-91cd-5337-9575-e7c41a3d665e', '17be775f-608a-59cb-a140-9a25d0ceae96', 'One-arm Dumbbell Row', '3 × 8–10 / side', '90 sec', '', 'Support the bench. Pull the elbow past the hip.', array['dumbbell', 'bench']::text[], null, 3),
  ('89aff619-6185-5c1c-9805-10b47ede76f4', '17be775f-608a-59cb-a140-9a25d0ceae96', 'Dip', '2 × 6–10', '90 sec', '', 'Shoulders down. Stop before the bottom gets sloppy.', array['bodyweight']::text[], null, 4),
  ('f04a8d62-1067-5f8f-9143-e9b6a241defe', '17be775f-608a-59cb-a140-9a25d0ceae96', 'Lateral Raise', '2 × 12–15', '60 sec', '', 'Soft elbows. Stop at shoulder height.', array['dumbbell']::text[], null, 5),
  ('59d9e252-ad22-5fbb-ace1-1efdcc8f79af', '2f047c8e-ed0e-5c03-beaa-e4a5ca3a4460', 'Easy walk or easy breathing', '2–3 min', '', '', '', '{}'::text[], null, 0),
  ('f800bd97-c34f-5c32-9ec0-c1a638618f30', '2f047c8e-ed0e-5c03-beaa-e4a5ca3a4460', 'Doorway Chest Stretch', '30–45 sec / side', '', '', '', '{}'::text[], null, 1),
  ('b8fcae80-34cd-5770-8178-7ba1b6c3dc61', '2f047c8e-ed0e-5c03-beaa-e4a5ca3a4460', 'Lat Stretch', '30–45 sec / side', '', '', 'Reach high on a rack or door frame.', '{}'::text[], null, 2),
  ('8d956444-88e8-5ebb-bf7f-65a57423a178', '2f047c8e-ed0e-5c03-beaa-e4a5ca3a4460', 'Cross-body Shoulder Stretch', '30–45 sec / side', '', '', '', '{}'::text[], null, 3),
  ('1d0bce05-5541-566d-bed5-a9b5033c50ab', '2f047c8e-ed0e-5c03-beaa-e4a5ca3a4460', 'Wrist Extension Stretch', '20–30 sec / side', '', '', '', '{}'::text[], null, 4),
  ('9de9a6dd-d5ee-5d4c-8485-9455a9fc5b41', '2f9ea8cc-4aab-5150-8132-305171fe4fa0', 'Arm Circles', '10 each way', '', '', 'Slow. Stay in a pain-free range.', array['bodyweight']::text[], null, 0),
  ('6c5a9907-3ce1-5454-bd87-f58a9bdcb8b2', '2f9ea8cc-4aab-5150-8132-305171fe4fa0', 'Scapular Push-up', '2 × 8', '', '', 'Lock the elbows. Move only the shoulder blades.', array['bodyweight']::text[], null, 1),
  ('10e3b59a-1020-5cc2-b956-be559f9e20e0', '2f9ea8cc-4aab-5150-8132-305171fe4fa0', 'Band Pull-apart', '2 × 12', '', '', 'Thumbs up. Stop before the ribs flare.', array['resistance-band']::text[], null, 2),
  ('de2854b4-b896-5b03-9692-9c55ee39b929', '2f9ea8cc-4aab-5150-8132-305171fe4fa0', 'Y-T-W Raise', '1 × 8 each', '', '', 'Light. Face down on a bench if you have one.', array['bodyweight', 'bench']::text[], null, 3),
  ('dba6c354-e8e1-57be-a31d-9bbe34842d8b', '2f9ea8cc-4aab-5150-8132-305171fe4fa0', 'Ramp-up sets', '2–4 light sets of the first press or pull.', '', '', '', '{}'::text[], null, 4),
  ('9dacfe42-0680-5cf9-bd8c-6921dc4aac3f', 'ea5fd1b5-07ec-5142-8a26-853848cb8df4', 'Warm-up', '1 km easy jog
Dynamic drills
2–3 relaxed strides', '', '', '', '{}'::text[], null, 0),
  ('099d2ae5-648f-57f0-974d-366be9991b2e', 'ea5fd1b5-07ec-5142-8a26-853848cb8df4', 'Main', '6 × 200m hard
Even effort. Leave a little for the last two.', '', 'RPE 8 / 10', '', '{}'::text[], null, 1),
  ('d09f0fe4-dff7-5967-99cb-1cd59b7a0293', 'ea5fd1b5-07ec-5142-8a26-853848cb8df4', 'Recovery', '200m walk/jog between repetitions', '', '', '', '{}'::text[], null, 2),
  ('60be9955-da6a-54f7-967e-a97756f50036', 'ea5fd1b5-07ec-5142-8a26-853848cb8df4', 'Cooldown', '1 km easy jog', '', '', '', '{}'::text[], null, 3),
  ('afd335fd-d428-5e30-98bf-7338a9ed7d89', 'ea5fd1b5-07ec-5142-8a26-853848cb8df4', 'Progression', '200m → 300m → 400m → 600m over future sessions, same recovery idea.', '', '', '', '{}'::text[], null, 4)
on conflict (id) do update
  set routine_id = excluded.routine_id,
      name = excluded.name,
      instruction = excluded.instruction,
      rest = excluded.rest,
      target = excluded.target,
      notes = excluded.notes,
      equipment = excluded.equipment,
      video_url = excluded.video_url,
      sort_order = excluded.sort_order;

commit;
