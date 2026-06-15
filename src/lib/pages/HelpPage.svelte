<script lang="ts">
  import { HelpCircle, Book, MessageCircle, ExternalLink, ChevronRight, Coffee, Heart } from '../icons';
  import Icon from '../components/Icon.svelte';
  
  const faqs = [
    {
      question: "How do I get started?",
      answer: "Navigate through the extension using the dock icons at the bottom. Start with the Home page to explore features."
    },
    {
      question: "How do I change the theme?",
      answer: "Click the theme toggle button in the top-right corner or visit Settings to switch between light and dark modes."
    },
    {
      question: "Is my data secure?",
      answer: "Yes! This extension runs entirely in your browser. No data is sent to external servers."
    },
    {
      question: "How do I report a bug?",
      answer: "Please submit issues through our GitHub repository or contact support via the feedback form below."
    }
  ];
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-3">
    <Icon icon={HelpCircle} size={32} class="text-primary" />
    <div>
      <h1 class="text-3xl font-bold">Help & Support</h1>
      <p class="text-sm opacity-70">Get answers to your questions</p>
    </div>
  </div>

  <!-- Quick Links -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="card bg-primary text-primary-content shadow-xl cursor-pointer hover:scale-105 transition-transform">
      <div class="card-body items-center text-center">
        <Icon icon={Book} size={40} />
        <h3 class="card-title">Documentation</h3>
        <p class="text-sm opacity-90">Learn how to use all features</p>
      </div>
    </div>
    
    <div class="card bg-secondary text-secondary-content shadow-xl cursor-pointer hover:scale-105 transition-transform">
      <div class="card-body items-center text-center">
        <Icon icon={MessageCircle} size={40} />
        <h3 class="card-title">Community</h3>
        <p class="text-sm opacity-90">Join our Discord server</p>
      </div>
    </div>
    
    <div class="card bg-accent text-accent-content shadow-xl cursor-pointer hover:scale-105 transition-transform">
      <div class="card-body items-center text-center">
        <Icon icon={ExternalLink} size={40} />
        <h3 class="card-title">GitHub</h3>
        <p class="text-sm opacity-90">View source code</p>
      </div>
    </div>
  </div>

  <!-- FAQ Section -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl mb-4">Frequently Asked Questions</h2>
      
      <div class="space-y-2">
        {#each faqs as faq}
          <div class="collapse collapse-arrow bg-base-300">
            <input type="radio" name="faq-accordion" />
            <div class="collapse-title text-lg font-medium">
              {faq.question}
            </div>
            <div class="collapse-content">
              <p class="opacity-80">{faq.answer}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Contact Form -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">Still need help?</h2>
      <p class="text-sm opacity-70 mb-4">Send us a message and we'll get back to you soon.</p>
      
      <form class="space-y-4">
        <div class="form-control">
          <label class="label" for="contact-name">
            <span class="label-text">Your Name</span>
          </label>
          <input id="contact-name" type="text" placeholder="John Doe" class="input input-bordered w-full" />
        </div>
        
        <div class="form-control">
          <label class="label" for="contact-email">
            <span class="label-text">Email</span>
          </label>
          <input id="contact-email" type="email" placeholder="john@example.com" class="input input-bordered w-full" />
        </div>
        
        <div class="form-control">
          <label class="label" for="contact-message">
            <span class="label-text">Message</span>
          </label>
          <textarea id="contact-message" class="textarea textarea-bordered h-24" placeholder="Describe your issue..."></textarea>
        </div>
        
        <button type="submit" class="btn btn-primary w-full">
          Send Message
          <Icon icon={ChevronRight} size={20} />
        </button>
      </form>
    </div>
  </div>

  <!-- Support the Developer -->
  <div class="card bg-gradient-to-br from-orange-500 to-pink-500 text-white shadow-xl">
    <div class="card-body items-center text-center">
      <div class="flex gap-2 items-center mb-2">
        <Icon icon={Coffee} size={32} />
        <Icon icon={Heart} size={24} class="text-red-200" />
      </div>
      <h2 class="card-title text-2xl">Enjoying this extension?</h2>
      <p class="opacity-90 mb-4">
        If you find this project helpful, consider buying me a coffee! Your support helps keep development going.
      </p>
      <a 
        href="https://ko-fi.com/trentbrew" 
        target="_blank" 
        rel="noopener noreferrer"
        class="btn btn-lg bg-white text-orange-600 hover:bg-orange-50 border-none"
      >
        <Icon icon={Coffee} size={20} />
        Support on Ko-fi
        <Icon icon={ExternalLink} size={16} />
      </a>
      <p class="text-xs opacity-75 mt-2">Thank you for your support! ❤️</p>
    </div>
  </div>

  <!-- Tips -->
  <div class="alert alert-info">
    <Icon icon={HelpCircle} size={24} />
    <div>
      <h3 class="font-bold">Pro Tip</h3>
      <div class="text-xs">Press <kbd class="kbd kbd-sm">Ctrl</kbd> + <kbd class="kbd kbd-sm">Shift</kbd> + <kbd class="kbd kbd-sm">H</kbd> to quickly open this help page!</div>
    </div>
  </div>
</div>
