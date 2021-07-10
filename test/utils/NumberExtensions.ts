import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

Object.defineProperties(Number.prototype, {
  eth: {
    get() {
      return parseEther(this.toString())
    }
  },

  gwei: {
    get() {
      return BigNumber.from(this).mul(10 ** 9)
    }
  },

  wei: {
    get() {
      return BigNumber.from(this)
    }
  },

  years: {
    get() {
      return this.days * 365
    }
  },

  year: {
    get() {
      return this.days * 365
    }
  },

  days: {
    get() {
      return this.hours * 24
    }
  },

  day: {
    get() {
      return this.hours * 24
    }
  },

  hours: {
    get() {
      return this.minutes * 60
    }
  },

  hour: {
    get() {
      return this.minutes * 60
    }
  },

  minutes: {
    get() {
      return this * 60
    }
  },

  minute: {
    get() {
      return this * 60
    }
  },

  ms: {
    get() {
      return Math.floor(this / 1000)
    }
  }
})

Number.prototype.percent = function (n: number) {
  return (this.valueOf() * n) / 100
}

declare global {
  interface Number {
    get eth(): BigNumber
    get gwei(): BigNumber
    get wei(): BigNumber

    get years(): number
    get year(): number
    get days(): number
    get day(): number
    get hours(): number
    get hour(): number

    get ms(): number

    percent(n: number): number
  }
}
