'use client'

import { useState, useEffect } from 'react'

const QUOTES = [
  { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
  { text: "The four most dangerous words in investing are: 'This time it's different.'", author: "Sir John Templeton" },
  { text: "In investing, what is comfortable is rarely profitable.", author: "Robert Arnott" },
  { text: "The market can stay irrational longer than you can stay solvent.", author: "John Maynard Keynes" },
  { text: "Know what you own, and know why you own it.", author: "Peter Lynch" },
  { text: "The biggest risk of all is not taking one.", author: "Mellody Hobson" },
  { text: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.", author: "George Soros" },
  { text: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder" },
  { text: "Losses are necessary, as long as they are associated with a technique to help you learn from them.", author: "David Sikhosana" },
  { text: "The trend is your friend until the end when it bends.", author: "Ed Seykota" },
  { text: "Trade what you see, not what you think.", author: "Trading Proverb" },
  { text: "Cut your losses short and let your winners run.", author: "Jesse Livermore" },
  { text: "Markets are never wrong — opinions often are.", author: "Jesse Livermore" },
  { text: "There is no single market secret to discover, no single correct way to trade the markets.", author: "Jack Schwager" },
  { text: "The elements of good trading are: cutting losses, cutting losses, and cutting losses.", author: "Ed Seykota" },
  { text: "Compound interest is the eighth wonder of the world.", author: "Albert Einstein" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Time in the market beats timing the market.", author: "Ken Fisher" },
  { text: "The key to trading success is emotional discipline.", author: "Victor Sperandeo" },
  { text: "Plan your trade and trade your plan.", author: "Trading Proverb" },
  { text: "Bulls make money, bears make money, pigs get slaughtered.", author: "Wall Street Proverb" },
  { text: "Don't look for the needle in the haystack. Just buy the haystack.", author: "John Bogle" },
  { text: "You get recessions, you have stock market declines. If you don't understand that's going to happen, then you're not ready.", author: "Peter Lynch" },
  { text: "Wide diversification is only required when investors do not understand what they are doing.", author: "Warren Buffett" },
  { text: "The stock market is filled with individuals who know the price of everything, but the value of nothing.", author: "Philip Fisher" },
  { text: "Successful investing is about managing risk, not avoiding it.", author: "Benjamin Graham" },
  { text: "The investor's chief problem — and even his worst enemy — is likely to be himself.", author: "Benjamin Graham" },
  { text: "Price is what you pay. Value is what you get.", author: "Warren Buffett" },
  { text: "Rule No. 1: Never lose money. Rule No. 2: Never forget Rule No. 1.", author: "Warren Buffett" },
  { text: "I will tell you how to become rich. Close the doors. Be fearful when others are greedy. Be greedy when others are fearful.", author: "Warren Buffett" },
  { text: "The desire to perform all the time is usually a barrier to performing over time.", author: "Robert Olstein" },
  { text: "It's not about being right or wrong. It's about how much you make when you're right and how little you lose when you're wrong.", author: "George Soros" },
  { text: "Trading doesn't just reveal your character, it also builds it if you stay in the game long enough.", author: "Yvan Byeajee" },
  { text: "Opportunities come infrequently. When it rains gold, put out the bucket, not the thimble.", author: "Warren Buffett" },
  { text: "The secret to being successful from a trading perspective is to have an indefatigable and an undying and unquenchable thirst for information and knowledge.", author: "Paul Tudor Jones" },
  { text: "Do not be embarrassed by your failures, learn from them and start again.", author: "Richard Branson" },
  { text: "The only way to make money in the market is to have an edge and the discipline to follow it.", author: "Mark Douglas" },
  { text: "Investing should be more like watching paint dry or watching grass grow. If you want excitement, take $800 and go to Las Vegas.", author: "Paul Samuelson" },
  { text: "If you aren't thinking about owning a stock for 10 years, don't even think about owning it for 10 minutes.", author: "Warren Buffett" },
  { text: "The most important quality for an investor is temperament, not intellect.", author: "Warren Buffett" },
  { text: "Never invest in a business you cannot understand.", author: "Warren Buffett" },
  { text: "In the short run, the market is a voting machine but in the long run, it is a weighing machine.", author: "Benjamin Graham" },
  { text: "I've found that when the market's going down and you buy funds wisely, at some point in the future you will be happy.", author: "Peter Lynch" },
  { text: "The best investment you can make is in yourself.", author: "Warren Buffett" },
  { text: "One of the funny things about the stock market is that every time one person buys, another sells, and both think they are astute.", author: "William Feather" },
  { text: "Money is always eager and ready to work for anyone who is ready to employ it.", author: "Idowu Koyenikan" },
  { text: "The market is a pendulum that forever swings between unsustainable optimism and unjustified pessimism.", author: "Benjamin Graham" },
  { text: "Behind every stock is a company. Find out what it's doing.", author: "Peter Lynch" },
  { text: "Courage taught me that no matter how bad a crisis gets, any sound investment will eventually pay off.", author: "Carlos Slim Helu" },
]

export default function QuoteBanner() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex(prev => (prev + 1) % QUOTES.length)
        setFading(false)
      }, 400)
    }, 45_000) // Cycle every 45 seconds
    return () => clearInterval(interval)
  }, [])

  const quote = QUOTES[index]

  return (
    <div className="w-full py-2 px-4 text-center overflow-hidden">
      <p className={`text-[11px] italic text-[var(--text-muted)] transition-opacity duration-400 ${fading ? 'opacity-0' : 'opacity-100'}`}>
        &ldquo;{quote.text}&rdquo;
        <span className="not-italic font-medium ml-1.5">— {quote.author}</span>
      </p>
    </div>
  )
}
