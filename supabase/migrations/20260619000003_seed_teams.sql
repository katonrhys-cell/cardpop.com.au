-- Seed teams for the leagues we support out of the gate: NBA, AFL, NRL, NBL,
-- MLB (Baseball), NHL (Hockey) and NFL (Football). Franchises are looked up by
-- name scoped to the Sports root category, and slugs are derived from the team
-- name. Idempotent via ON CONFLICT on (franchise_id, slug).

with sports_root as (
  select id from public.categories where name = 'Sports' and parent_id is null limit 1
),
data(franchise, team) as (
  values
  -- NBA (30)
  ('NBA','Atlanta Hawks'),('NBA','Boston Celtics'),('NBA','Brooklyn Nets'),('NBA','Charlotte Hornets'),
  ('NBA','Chicago Bulls'),('NBA','Cleveland Cavaliers'),('NBA','Dallas Mavericks'),('NBA','Denver Nuggets'),
  ('NBA','Detroit Pistons'),('NBA','Golden State Warriors'),('NBA','Houston Rockets'),('NBA','Indiana Pacers'),
  ('NBA','LA Clippers'),('NBA','Los Angeles Lakers'),('NBA','Memphis Grizzlies'),('NBA','Miami Heat'),
  ('NBA','Milwaukee Bucks'),('NBA','Minnesota Timberwolves'),('NBA','New Orleans Pelicans'),('NBA','New York Knicks'),
  ('NBA','Oklahoma City Thunder'),('NBA','Orlando Magic'),('NBA','Philadelphia 76ers'),('NBA','Phoenix Suns'),
  ('NBA','Portland Trail Blazers'),('NBA','Sacramento Kings'),('NBA','San Antonio Spurs'),('NBA','Toronto Raptors'),
  ('NBA','Utah Jazz'),('NBA','Washington Wizards'),
  -- AFL (18)
  ('AFL','Adelaide Crows'),('AFL','Brisbane Lions'),('AFL','Carlton Blues'),('AFL','Collingwood Magpies'),
  ('AFL','Essendon Bombers'),('AFL','Fremantle Dockers'),('AFL','Geelong Cats'),('AFL','Gold Coast Suns'),
  ('AFL','GWS Giants'),('AFL','Hawthorn Hawks'),('AFL','Melbourne Demons'),('AFL','North Melbourne Kangaroos'),
  ('AFL','Port Adelaide Power'),('AFL','Richmond Tigers'),('AFL','St Kilda Saints'),('AFL','Sydney Swans'),
  ('AFL','West Coast Eagles'),('AFL','Western Bulldogs'),
  -- NRL (17)
  ('NRL','Brisbane Broncos'),('NRL','Canberra Raiders'),('NRL','Canterbury-Bankstown Bulldogs'),
  ('NRL','Cronulla-Sutherland Sharks'),('NRL','Dolphins'),('NRL','Gold Coast Titans'),
  ('NRL','Manly-Warringah Sea Eagles'),('NRL','Melbourne Storm'),('NRL','Newcastle Knights'),
  ('NRL','New Zealand Warriors'),('NRL','North Queensland Cowboys'),('NRL','Parramatta Eels'),
  ('NRL','Penrith Panthers'),('NRL','South Sydney Rabbitohs'),('NRL','St George Illawarra Dragons'),
  ('NRL','Sydney Roosters'),('NRL','Wests Tigers'),
  -- NBL (10)
  ('NBL','Adelaide 36ers'),('NBL','Brisbane Bullets'),('NBL','Cairns Taipans'),('NBL','Illawarra Hawks'),
  ('NBL','Melbourne United'),('NBL','New Zealand Breakers'),('NBL','Perth Wildcats'),
  ('NBL','South East Melbourne Phoenix'),('NBL','Sydney Kings'),('NBL','Tasmania JackJumpers'),
  -- MLB -> Baseball (30)
  ('Baseball','Arizona Diamondbacks'),('Baseball','Atlanta Braves'),('Baseball','Baltimore Orioles'),
  ('Baseball','Boston Red Sox'),('Baseball','Chicago Cubs'),('Baseball','Chicago White Sox'),
  ('Baseball','Cincinnati Reds'),('Baseball','Cleveland Guardians'),('Baseball','Colorado Rockies'),
  ('Baseball','Detroit Tigers'),('Baseball','Houston Astros'),('Baseball','Kansas City Royals'),
  ('Baseball','Los Angeles Angels'),('Baseball','Los Angeles Dodgers'),('Baseball','Miami Marlins'),
  ('Baseball','Milwaukee Brewers'),('Baseball','Minnesota Twins'),('Baseball','New York Mets'),
  ('Baseball','New York Yankees'),('Baseball','Oakland Athletics'),('Baseball','Philadelphia Phillies'),
  ('Baseball','Pittsburgh Pirates'),('Baseball','San Diego Padres'),('Baseball','San Francisco Giants'),
  ('Baseball','Seattle Mariners'),('Baseball','St. Louis Cardinals'),('Baseball','Tampa Bay Rays'),
  ('Baseball','Texas Rangers'),('Baseball','Toronto Blue Jays'),('Baseball','Washington Nationals'),
  -- NHL -> Hockey (32)
  ('Hockey','Anaheim Ducks'),('Hockey','Arizona Coyotes'),('Hockey','Boston Bruins'),('Hockey','Buffalo Sabres'),
  ('Hockey','Calgary Flames'),('Hockey','Carolina Hurricanes'),('Hockey','Chicago Blackhawks'),
  ('Hockey','Colorado Avalanche'),('Hockey','Columbus Blue Jackets'),('Hockey','Dallas Stars'),
  ('Hockey','Detroit Red Wings'),('Hockey','Edmonton Oilers'),('Hockey','Florida Panthers'),
  ('Hockey','Los Angeles Kings'),('Hockey','Minnesota Wild'),('Hockey','Montreal Canadiens'),
  ('Hockey','Nashville Predators'),('Hockey','New Jersey Devils'),('Hockey','New York Islanders'),
  ('Hockey','New York Rangers'),('Hockey','Ottawa Senators'),('Hockey','Philadelphia Flyers'),
  ('Hockey','Pittsburgh Penguins'),('Hockey','San Jose Sharks'),('Hockey','Seattle Kraken'),
  ('Hockey','St. Louis Blues'),('Hockey','Tampa Bay Lightning'),('Hockey','Toronto Maple Leafs'),
  ('Hockey','Vancouver Canucks'),('Hockey','Vegas Golden Knights'),('Hockey','Washington Capitals'),
  ('Hockey','Winnipeg Jets'),
  -- NFL -> Football (32)
  ('Football','Arizona Cardinals'),('Football','Atlanta Falcons'),('Football','Baltimore Ravens'),
  ('Football','Buffalo Bills'),('Football','Carolina Panthers'),('Football','Chicago Bears'),
  ('Football','Cincinnati Bengals'),('Football','Cleveland Browns'),('Football','Dallas Cowboys'),
  ('Football','Denver Broncos'),('Football','Detroit Lions'),('Football','Green Bay Packers'),
  ('Football','Houston Texans'),('Football','Indianapolis Colts'),('Football','Jacksonville Jaguars'),
  ('Football','Kansas City Chiefs'),('Football','Las Vegas Raiders'),('Football','Los Angeles Chargers'),
  ('Football','Los Angeles Rams'),('Football','Miami Dolphins'),('Football','Minnesota Vikings'),
  ('Football','New England Patriots'),('Football','New Orleans Saints'),('Football','New York Giants'),
  ('Football','New York Jets'),('Football','Philadelphia Eagles'),('Football','Pittsburgh Steelers'),
  ('Football','San Francisco 49ers'),('Football','Seattle Seahawks'),('Football','Tampa Bay Buccaneers'),
  ('Football','Tennessee Titans'),('Football','Washington Commanders')
)
insert into public.teams (name, slug, franchise_id, sort_order)
select
  d.team,
  trim(both '-' from regexp_replace(lower(d.team), '[^a-z0-9]+', '-', 'g')) as slug,
  c.id,
  row_number() over (partition by c.id order by d.team) as sort_order
from data d
join public.categories c
  on c.name = d.franchise
 and c.parent_id = (select id from sports_root)
on conflict (franchise_id, slug) do nothing;
