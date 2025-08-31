import { EventEmitter } from 'events';
import crypto from 'crypto';
import { WebhookConfig, WebhookEvent, WebhookDelivery, WebhookSubscription } from '../types';

export class WebhookManager extends EventEmitter {
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private deliveryQueue: WebhookDelivery[] = [];
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor(private config: WebhookConfig) {
    super();
    this.startDeliveryProcessor();
  }

  async subscribe(subscription: Omit<WebhookSubscription, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const webhookSubscription: WebhookSubscription = {
      ...subscription,
      id,
      createdAt: new Date(),
    };

    this.subscriptions.set(id, webhookSubscription);
    return id;
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    return this.subscriptions.delete(subscriptionId);
  }

  async triggerEvent(event: WebhookEvent): Promise<void> {
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.events.includes(event.type));

    for (const subscription of relevantSubscriptions) {
      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        subscriptionId: subscription.id,
        event,
        url: subscription.url,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      };

      this.deliveryQueue.push(delivery);
    }
  }

  private async startDeliveryProcessor(): Promise<void> {
    setInterval(async () => {
      const pendingDeliveries = this.deliveryQueue.filter(d => d.status === 'pending');
      
      for (const delivery of pendingDeliveries) {
        await this.processDelivery(delivery);
      }
    }, 1000);
  }

  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    try {
      const subscription = this.subscriptions.get(delivery.subscriptionId);
      if (!subscription) {
        delivery.status = 'failed';
        delivery.error = 'Subscription not found';
        return;
      }

      const payload = JSON.stringify(delivery.event);
      const signature = this.generateSignature(payload, subscription.secret);

      // Mock webhook delivery - in real implementation would use fetch or axios
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      
      if (mockResponse.ok) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
      } else {
        throw new Error(`HTTP ${mockResponse.status}: ${mockResponse.statusText}`);
      }
    } catch (error) {
      delivery.attempts++;
      delivery.error = error instanceof Error ? error.message : 'Unknown error';

      if (delivery.attempts >= this.retryAttempts) {
        delivery.status = 'failed';
      } else {
        // Exponential backoff
        setTimeout(() => {
          delivery.status = 'pending';
        }, this.retryDelay * Math.pow(2, delivery.attempts - 1));
      }
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  getDeliveries(subscriptionId?: string): WebhookDelivery[] {
    return this.deliveryQueue.filter(d => 
      !subscriptionId || d.subscriptionId === subscriptionId
    );
  }
}