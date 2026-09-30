-- Tracker v2.1: board presence. Only the private `tracker-board-<projectId>` channel (presence + `cell`
-- broadcasts) is authorized here; public channels with the same topic are separate rooms.
-- Rollback: drop policy tracker_board_read on realtime.messages; drop policy tracker_board_write on realtime.messages;

create policy tracker_board_read on realtime.messages
    for select to authenticated
    using (
        (select realtime.topic()) like 'tracker-board-%'
        and realtime.messages.extension in ('broadcast', 'presence')
        and (select public.is_tracker_user())
    );

create policy tracker_board_write on realtime.messages
    for insert to authenticated
    with check (
        (select realtime.topic()) like 'tracker-board-%'
        and realtime.messages.extension in ('broadcast', 'presence')
        and (select public.is_tracker_user())
    );
