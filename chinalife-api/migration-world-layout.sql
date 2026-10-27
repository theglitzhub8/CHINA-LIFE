-- One-city world layout (docs/ONE-CITY.md). Adds the setting only if it is missing; never overwrites an admin choice.
-- Turn everything back on from admin (World layout → Classic) or:
-- UPDATE chinalife_settings SET value='{"mode":"classic","city":"China","places":["night","gist","voting","football","hq","cityhospital","university"],"where_to":false,"flights":true}' WHERE name='world_layout';
INSERT IGNORE INTO chinalife_settings(name,value,updated_at) VALUES('world_layout','{"mode":"one-city","city":"China","places":["night","gist","voting","football","hq","cityhospital","university"],"where_to":true,"flights":false}',NOW());
