<?php
// Services players can apply for at Hafrik HQ. Applications are reviewed by admins in the panel.
$services = [
 'study'=>['icon'=>'🎓','title'=>'Study in China','detail'=>'University admission and scholarship guidance'],
 'visa'=>['icon'=>'🛂','title'=>'Visa & residence permit','detail'=>'Help with visa, extensions and residence permits'],
 'housing'=>['icon'=>'🏠','title'=>'Find an apartment','detail'=>'Apartments and rooms near your school or work'],
 'jobs'=>['icon'=>'💼','title'=>'Jobs & internships','detail'=>'Placement in companies hiring foreigners'],
 'business'=>['icon'=>'🏢','title'=>'Start a business in China','detail'=>'Company registration, licences and banking'],
 'arrival'=>['icon'=>'✈️','title'=>'Arrival package','detail'=>'Airport pickup, SIM card, bank card, Alipay and WeChat Pay'],
 'translation'=>['icon'=>'🗣','title'=>'Translation & interpreting','detail'=>'Documents, meetings and hospital visits'],
 'advertise'=>['icon'=>'📣','title'=>'Advertise with Hafrik','detail'=>'Billboards in ChinaLife and promotion on Hafrik'],
 'community'=>['icon'=>'🤝','title'=>'Community support','detail'=>'Getting started, community enquiries and account guidance'],
 'complaint'=>['icon'=>'💬','title'=>'Feedback & complaints','detail'=>'Report a service concern without sharing passwords'],
 'ceo-meeting'=>['icon'=>'📅','title'=>'CEO appointment','detail'=>'Lawrence manages meeting requests and entry approval'],
 'careers'=>['icon'=>'💼','title'=>'Work at Hafrik HQ','detail'=>'Apply with your preferred role, experience and portfolio link'],
 'artist-promotion'=>['icon'=>'🎤','title'=>'Artist publicity','detail'=>'Music release promotion and artist campaigns'],
 'events'=>['icon'=>'🎟️','title'=>'Event promotion','detail'=>'Community events, launches and sponsorship enquiries'],
 'content'=>['icon'=>'📱','title'=>'Content collaboration','detail'=>'Social media campaigns, creators and content submissions'],
 'hotel'=>['icon'=>'🏨','title'=>'Hotel booking','detail'=>'Accommodation assistance across China'],
 'market'=>['icon'=>'🛍️','title'=>'Market visitation','detail'=>'Guided sourcing and market visits'],
 'partnership'=>['icon'=>'🤝','title'=>'Business partnerships','detail'=>'Partner onboarding and operating arrangements'],
 'operations'=>['icon'=>'🧰','title'=>'Service escalation','detail'=>'Help with an existing service or unresolved request'],
 'major-proposal'=>['icon'=>'🏢','title'=>'CEO business proposal','detail'=>'Major strategic partnerships and business proposals'],
];

$team=require __DIR__.'/hq-team.php';
foreach($team as $member) foreach($member['services'] as $id) if(isset($services[$id])) {$services[$id]['owner']=$member['id'];$services[$id]['answer']='Tell us your city, preferred dates and what help you need. '.$member['short'].' will review your request and confirm requirements, availability and any quote. Do not send passwords or identity documents here.';}
return $services;
