<script lang="ts">
  import { Button, Card, Input, Modal, Badge, Alert } from '../components/ui';
  import Icon from '../components/Icon.svelte';
  import { Home, Settings, Check, X, Info } from '../icons';

  let showModal = $state(false);
  let showConfirmDialog = $state(false);
  let showFormDialog = $state(false);
  let inputValue = $state('');
  let count = $state(0);
  let formData = $state({ name: '', email: '' });
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-4xl font-bold mb-2">UI Components Demo</h1>
    <p class="text-lg opacity-70">Foundational DaisyUI components</p>
  </div>

  <!-- Buttons -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Buttons</h2>
    <div class="flex flex-wrap gap-2">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="accent">Accent</Button>
      <Button variant="success">Success</Button>
      <Button variant="error">Error</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="info">Info</Button>
      <Button variant="ghost">Ghost</Button>
    </div>

    <div class="divider">Outlined</div>
    <div class="flex flex-wrap gap-2">
      <Button variant="primary" outline>Primary</Button>
      <Button variant="secondary" outline>Secondary</Button>
      <Button variant="accent" outline>Accent</Button>
    </div>

    <div class="divider">Sizes</div>
    <div class="flex flex-wrap items-center gap-2">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>

    <div class="divider">Special</div>
    <div class="flex flex-wrap gap-2">
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
      <Button circle>+</Button>
      <Button square>□</Button>
      <Button wide>Wide Button</Button>
    </div>
  </section>

  <!-- Cards -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Cards</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Basic Card">
        {#snippet children()}
          <p>This is a simple card with a title and content.</p>
        {/snippet}
      </Card>

      <Card title="Card with Actions">
        {#snippet children()}
          <p>This card has action buttons at the bottom.</p>
        {/snippet}
        {#snippet actions()}
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary">Accept</Button>
        {/snippet}
      </Card>

      <Card bordered title="Bordered Card">
        {#snippet children()}
          <p>This card has a visible border.</p>
        {/snippet}
      </Card>

      <Card compact title="Compact Card">
        {#snippet children()}
          <p>This card uses less padding.</p>
        {/snippet}
      </Card>
    </div>
  </section>

  <!-- Inputs -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Inputs</h2>
    <div class="space-y-4 max-w-md">
      <Input bind:value={inputValue} placeholder="Default input" />
      <Input placeholder="Primary" primary />
      <Input placeholder="Secondary" secondary />
      <Input placeholder="Accent" accent />

      <div class="divider">States</div>
      <Input placeholder="Success" success />
      <Input placeholder="Error" error />
      <Input placeholder="Warning" warning />
      <Input placeholder="Info" info />

      <div class="divider">Sizes</div>
      <Input size="xs" placeholder="Extra small" />
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />

      <div class="divider">Types</div>
      <Input type="email" placeholder="Email" />
      <Input type="password" placeholder="Password" />
      <Input type="number" placeholder="Number" />
    </div>
  </section>

  <!-- Badges -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Badges</h2>
    <div class="flex flex-wrap gap-2 mb-4">
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="accent">Accent</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
    </div>

    <div class="divider">Outlined</div>
    <div class="flex flex-wrap gap-2 mb-4">
      <Badge outline variant="primary">Primary</Badge>
      <Badge outline variant="secondary">Secondary</Badge>
      <Badge outline variant="accent">Accent</Badge>
    </div>

    <div class="divider">Sizes</div>
    <div class="flex flex-wrap items-center gap-2">
      <Badge size="xs">XS</Badge>
      <Badge size="sm">Small</Badge>
      <Badge size="md">Medium</Badge>
      <Badge size="lg">Large</Badge>
    </div>
  </section>

  <!-- Alerts -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Alerts</h2>
    <div class="space-y-4">
      <Alert variant="info">
        {#snippet children()}
          This is an informational alert with an icon
        {/snippet}
      </Alert>

      <Alert variant="success">
        {#snippet children()}
          Your action was completed successfully!
        {/snippet}
      </Alert>

      <Alert variant="warning">
        {#snippet children()}
          Warning: This action cannot be undone
        {/snippet}
      </Alert>

      <Alert variant="error">
        {#snippet children()}
          Error: Something went wrong
        {/snippet}
      </Alert>

      <Alert variant="info" showIcon={false}>
        {#snippet children()}
          Alert without an icon
        {/snippet}
      </Alert>
    </div>
  </section>

  <!-- Modal / Dialogs -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Modals & Dialogs</h2>

    <div class="flex flex-wrap gap-2 mb-4">
      <Button variant="primary" onclick={() => (showModal = true)}>
        Basic Modal
      </Button>
      <Button variant="warning" onclick={() => (showConfirmDialog = true)}>
        Confirmation Dialog
      </Button>
      <Button variant="secondary" onclick={() => (showFormDialog = true)}>
        Form Dialog
      </Button>
    </div>

    <!-- Basic Modal -->
    <Modal bind:open={showModal} title="Example Modal">
      {#snippet children()}
        <p class="py-4">
          This is a modal dialog. Click outside or press the close button to
          dismiss.
        </p>
        <div class="space-y-2">
          <Input placeholder="Enter something..." />
          <div class="flex gap-2">
            <Button variant="success" onclick={() => count++}>
              Count: {count}
            </Button>
          </div>
        </div>
      {/snippet}

      {#snippet actions()}
        <Button variant="ghost" onclick={() => (showModal = false)}>
          Cancel
        </Button>
        <Button variant="primary" onclick={() => (showModal = false)}>
          Accept
        </Button>
      {/snippet}
    </Modal>

    <!-- Confirmation Dialog -->
    <Modal bind:open={showConfirmDialog} title="Confirm Action">
      {#snippet children()}
        <Alert variant="warning">
          {#snippet children()}
            Are you sure you want to proceed? This action cannot be undone.
          {/snippet}
        </Alert>
        <p class="py-4">
          Please confirm that you want to continue with this action.
        </p>
      {/snippet}

      {#snippet actions()}
        <Button variant="ghost" onclick={() => (showConfirmDialog = false)}>
          Cancel
        </Button>
        <Button variant="error" onclick={() => (showConfirmDialog = false)}>
          Confirm Delete
        </Button>
      {/snippet}
    </Modal>

    <!-- Form Dialog -->
    <Modal bind:open={showFormDialog} title="User Information">
      {#snippet children()}
        <div class="space-y-4 py-4">
          <div class="form-control">
            <label class="label" for="dialog-name">
              <span class="label-text">Name</span>
            </label>
            <Input
              id="dialog-name"
              bind:value={formData.name}
              placeholder="Enter your name"
            />
          </div>

          <div class="form-control">
            <label class="label" for="dialog-email">
              <span class="label-text">Email</span>
            </label>
            <Input
              id="dialog-email"
              type="email"
              bind:value={formData.email}
              placeholder="Enter your email"
            />
          </div>

          {#if formData.name && formData.email}
            <Alert variant="success">
              {#snippet children()}
                Form is complete!
              {/snippet}
            </Alert>
          {/if}
        </div>
      {/snippet}

      {#snippet actions()}
        <Button variant="ghost" onclick={() => (showFormDialog = false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!formData.name || !formData.email}
          onclick={() => {
            alert(`Submitted: ${formData.name} (${formData.email})`);
            showFormDialog = false;
          }}
        >
          Submit
        </Button>
      {/snippet}
    </Modal>
  </section>

  <!-- Combined Example -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Combined Example</h2>
    <Card title="User Profile">
      {#snippet children()}
        <div class="flex items-center gap-4 mb-4">
          <div class="avatar placeholder">
            <div class="bg-neutral text-neutral-content rounded-full w-16">
              <span class="text-xl">JD</span>
            </div>
          </div>
          <div>
            <h3 class="font-bold text-lg">John Doe</h3>
            <div class="flex gap-2 mt-1">
              <Badge variant="primary" size="sm">Pro</Badge>
              <Badge variant="success" size="sm">Active</Badge>
            </div>
          </div>
        </div>

        <Alert variant="info">
          {#snippet children()}
            Your subscription will renew in 30 days
          {/snippet}
        </Alert>

        <div class="space-y-3 mt-4">
          <Input placeholder="Display name" value="John Doe" />
          <Input type="email" placeholder="Email" value="john@example.com" />
        </div>
      {/snippet}

      {#snippet actions()}
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Save Changes</Button>
      {/snippet}
    </Card>
  </section>
</div>
